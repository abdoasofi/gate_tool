// bus_exit.js
frappe.pages['bus-exit'].on_page_load = function(wrapper_element) {
    if (!$('link[href*="fontawesome"]').length && !$('script[src*="fontawesome"]').length && !$('link[href*="all.min.css"]').length) {
        let fontAwesomeCdnLink = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
        let linkTag = $(`<link rel="stylesheet" href="${fontAwesomeCdnLink}">`);
        $('head').append(linkTag);
    }

    let wrapper = $(wrapper_element);
    wrapper.empty().addClass('bus-exit-page-font');

    let gate_tool_settings_data = null;

    // متغيرات سيتم استخدامها عبر دوال مختلفة داخل on_page_load
    let selectedItem = null;
    let selectedCustomer = null;
    let selectedItemPrice = 0;
    let itemCurrency = frappe.boot.sysdefaults.currency || "USD";
    let exemption_mode_active = false;
    let customer_field = null; // سيتم تهيئته داخل render_page_content

    // الدالة الرئيسية التي تبدأ العملية: جلب الإعدادات ثم بناء الواجهة
    function load_and_render_page() {
        frappe.call({
            method: "frappe.client.get",
            args: { doctype: "Gate Tool Settings", name: "Gate Tool Settings" },
            callback: function(r_settings) {
                if (r_settings.message) {
                    gate_tool_settings_data = r_settings.message;
                    console.log("Gate Tool Settings loaded:", gate_tool_settings_data);
                    render_page_content();
                } else {
                    frappe.throw("لم يتم تحميل إعدادات Gate Tool. يرجى التحقق من إنشائها وتعيين القيم.");
                }
            },
            error: function(err_settings) {
                console.error("Error loading Gate Tool Settings:", err_settings);
                frappe.throw("خطأ فادح: لا يمكن تحميل إعدادات Gate Tool.");
            }
        });
    }

    // دالة بناء الواجهة وربط الأحداث والدوال المساعدة
    function render_page_content() {
        // --- تعديل HTML ليشمل أزرار اختيار العميل ---
        let html_content = `
            <div class="bus-exit-page-container">
                <div class="page-header">
                    <h1 class="page-title"><i class="fas fa-sign-out-alt page-icon-main"></i> تسجيل خروج الباص</h1>
                </div>
                <div class="selection-grid">
                    <div class="section customer-selection-section">
                        <label class="section-label"><i class="fas fa-bus section-icon"></i> اختر نوع السيارة</label>
                        <div id="customer-buttons-wrapper" class="customer-buttons-container">
                        </div>
                        <div id="selected-customer-info-exit" class="selected-info-badge"></div>
                    </div>
                    <div class="section items-selection-section">
                        <label class="section-label"><i class="fas fa-boxes section-icon"></i> اختر الصنف</label>
                        <div id="items-container-enhanced-exit" class="items-grid-container">
                            <p class="text-muted text-center">الرجاء اختيار نوع السيارة أولاً لعرض الأصناف.</p>
                        </div>
                    </div>
                </div>
                <div id="exemption-details-section" class="section" style="display: none; margin-top: 20px; border-color: var(--warning-color);">
                    <label for="exemption-reason" class="section-label" style="color: var(--warning-color);"><i class="fas fa-file-alt section-icon"></i> سبب الإعفاء (إجباري)</label>
                    <textarea id="exemption-reason" class="form-control" rows="3" placeholder="أدخل سبب الإعفاء هنا..."></textarea>
                </div>
                <div class="summary-and-action-section">
                    <div class="price-display-container">
                        <span class="price-label-text"><i class="fas fa-cash-register price-icon"></i> الإجمالي:</span>
                        <span id="price-value-enhanced" class="price-value">0.00</span>
                        <span id="price-currency-enhanced" class="price-currency"></span>
                    </div>
                    <div class="action-buttons-group" style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;">
                        <button id="print-exit-enhanced" class="btn btn-primary btn-lg btn-cta"><span class="button-icon"><i class="fas fa-receipt button-main-icon"></i></span><span class="button-text">خروج وطباعة الإيصال</span><span class="spinner-border spinner-border-sm d-none"></span></button>
                        <button id="process-exemption-btn" class="btn btn-success btn-lg btn-cta" style="display: none;"><i class="fas fa-check-circle"></i><span class="button-text">تأكيد الإعفاء والطباعة</span><span class="spinner-border spinner-border-sm d-none"></span></button>
                        <button id="toggle-exemption-btn" class="btn btn-warning btn-lg"><i class="fas fa-shield-alt"></i> <span class="button-text">إعفاء</span></button>
                    </div>
                </div>
                <div class="global-loader d-none"><div class="spinner-grow" role="status"></div></div>
            </div>
        `;
        wrapper.html(html_content);

        // --- تعريف عناصر jQuery بعد بناء HTML ---
        const $customerButtonsWrapper = wrapper.find('#customer-buttons-wrapper');
        const $selectedCustomerInfo = wrapper.find('#selected-customer-info-exit');
        const $itemsContainer = wrapper.find('#items-container-enhanced-exit');
        const $priceValue = wrapper.find('#price-value-enhanced');
        const $priceCurrency = wrapper.find('#price-currency-enhanced');
        const $printButton = wrapper.find('#print-exit-enhanced');
        const $globalLoader = wrapper.find('.global-loader');
        const $toggleExemptionBtn = wrapper.find('#toggle-exemption-btn');
        const $exemptionDetailsSection = wrapper.find('#exemption-details-section');
        const $exemptionReasonInput = wrapper.find('#exemption-reason');
        const $processExemptionBtn = wrapper.find('#process-exemption-btn');
        // --- إضافة أزرار العملاء من الإعدادات ---
        if (gate_tool_settings_data.customer_microbus) {
            let btn_microbus = $(`<button class="btn customer-type-btn" data-customer-id="${gate_tool_settings_data.customer_microbus}">
                                    <i class="fas fa-shuttle-van"></i> مايكروباص</button>`);
            $customerButtonsWrapper.append(btn_microbus);
        }
        if (gate_tool_settings_data.customer_bus) {
            let btn_bus = $(`<button class="btn customer-type-btn" data-customer-id="${gate_tool_settings_data.customer_bus}">
                                <i class="fas fa-bus-alt"></i> باص</button>`);
            $customerButtonsWrapper.append(btn_bus);
        }
        
        // دالة جديدة لاختيار العميل وتحديث الواجهة
        function selectCustomer(customer_id, customer_name) {
            selectedCustomer = customer_id;
            selectedItem = null; // إعادة تعيين الصنف المختار عند تغيير العميل
            $('.item-card-enhanced').removeClass('selected');
            $selectedCustomerInfo.text(` ${customer_name || customer_id}`).addClass('visible');
            // جلب مجموعة الأصناف المخصصة للعميل ثم تحميل الأصناف
            frappe.db.get_value("Customer", customer_id, "custom_item_group")
                .then(r => {
                    if (r && r.message && r.message.custom_item_group) {
                        const item_group = r.message.custom_item_group;
                        console.log(`Customer ${customer_id} has custom item group: ${item_group}`);
                        loadItems(item_group); // تمرير مجموعة الأصناف للدالة
                    } else {
                        console.log(`Customer ${customer_id} has no custom item group.`);
                        $itemsContainer.html('<p class="text-danger text-center">لم يتم تحديد مجموعة أصناف لهذا العميل.</p>');
                    }
                })
                .catch(err => {
                    console.error("Error fetching custom_item_group:", err);
                    $itemsContainer.html('<p class="text-danger text-center">خطأ في جلب مجموعة الأصناف للعميل.</p>');
                });           
            // إعادة تعيين السعر
            selectedItemPrice = 0;
            $priceValue.text(format_currency(0, itemCurrency));
            updateActionButtonsState();
        }

        // تعديل دالة تحميل الأصناف لتأخذ مجموعة الأصناف كمعامل
        function loadItems(item_group) {
            if (!item_group) {
                $itemsContainer.html('<p class="text-muted text-center">يرجى اختيار العميل أولاً.</p>');
                return;
            }
            $itemsContainer.html('<div class="spinner-border text-primary" role="status"><span class="sr-only">Loading...</span></div>');          
            frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Item', fields: ['name', 'item_name', 'image', 'item_code'],
                    filters: { 'item_group': item_group }, // استخدام القيمة الممررة
                    limit_page_length: 100
                },
                callback: function(r_items) {
                    $itemsContainer.empty();
                    if (r_items.message && r_items.message.length > 0) {
                        const fallbackImageUrl = '/assets/frappe/images/fallback-image.svg';
                        r_items.message.forEach((item) => {
                            let imageUrl = item.image ? item.image : fallbackImageUrl;
                            let card_html = `<div class="item-card-enhanced" data-item-code="${item.name}" data-item-name="${item.item_name || ''}"><img src="${imageUrl}" alt="${item.item_name || 'Item Image'}" onerror="this.onerror=null; this.src='${fallbackImageUrl}';"><div class="item-name">${item.item_name || 'صنف غير مسمى'}</div><div class="item-code-display">${item.item_code || 'لا يوجد رمز'}</div></div>`;
                            $itemsContainer.append(card_html);
                        });
                        $itemsContainer.off('click', '.item-card-enhanced').on('click', '.item-card-enhanced', function() {
                            $('.item-card-enhanced').removeClass('selected'); $(this).addClass('selected');
                            selectedItem = $(this).data('item-code');
                            if (selectedCustomer && !exemption_mode_active) fetchAndDisplayPrice();
                            else if (exemption_mode_active) $priceValue.text(format_currency(0, itemCurrency));
                            updateActionButtonsState();
                        });
                    } else {
                        $itemsContainer.html('<p class="text-muted text-center">لا توجد أصناف في هذه المجموعة.</p>');
                    }
                },
                error: (err_items) => { $globalLoader.addClass('d-none'); console.error("Error loading items:", err_items); $itemsContainer.html('<p class="text-danger text-center">خطأ في تحميل الأصناف.</p>');}
            });
        }        
        // --- ربط الأحداث لأزرار العملاء الجديدة ---
        $customerButtonsWrapper.on('click', '.customer-type-btn', function() {
            const customer_id = $(this).data('customer-id');
            const customer_name_text = $(this).text().trim(); // اسم الزر نفسه
            
            // إضافة كلاس 'active' للزر المختار
            $('.customer-type-btn').removeClass('active btn-primary').addClass('btn-secondary');
            $(this).removeClass('btn-secondary').addClass('active btn-primary');

            selectCustomer(customer_id, customer_name_text);
        });
        
        // --- الإعداد الافتراضي ---
        if (gate_tool_settings_data.customer_microbus) {
            // تفعيل زر الميكروباص افتراضيًا
            $customerButtonsWrapper.find(`[data-customer-id="${gate_tool_settings_data.customer_microbus}"]`).trigger('click');
        }

        function fetchAndDisplayPrice() {
            if (selectedItem && selectedCustomer && !exemption_mode_active) {
                frappe.call({
                    method: 'gate_tool.gate_tool.page.bus_exit.bus_exit.get_price',
                    args: { customer: selectedCustomer, item_code: selectedItem },
                    callback: function(r_price) {
                        if (r_price.message) {
                            if (r_price.message.error) { selectedItemPrice = 0; $priceValue.text('N/A'); $priceCurrency.text(''); frappe.show_alert({ message: r_price.message.error, indicator: 'orange' }, 3); }
                            else { selectedItemPrice = parseFloat(r_price.message.price) || 0; itemCurrency = r_price.message.currency || frappe.boot.sysdefaults.currency || "USD"; $priceValue.text(format_currency(selectedItemPrice, itemCurrency)); $priceCurrency.text(itemCurrency); }
                        } else { selectedItemPrice = 0; $priceValue.text('خطأ'); $priceCurrency.text(''); }
                        updateActionButtonsState();
                    },
                    error: (err_price) => { selectedItemPrice = 0; $priceValue.text('خطأ'); console.error("Error fetching price:", err_price); updateActionButtonsState(); }
                });
            } else if (exemption_mode_active) { selectedItemPrice = 0; $priceValue.text(format_currency(0, itemCurrency)); updateActionButtonsState(); }
            else { selectedItemPrice = 0; $priceValue.text(format_currency(0, itemCurrency)); updateActionButtonsState(); }
        }

        $toggleExemptionBtn.click(function() {
            exemption_mode_active = !exemption_mode_active;
            if (exemption_mode_active) {
                $exemptionDetailsSection.slideDown(); $(this).find('.button-text').text('إلغاء الإعفاء'); $(this).removeClass('btn-warning').addClass('btn-danger');
                selectedItemPrice = 0; $priceValue.text(format_currency(0, itemCurrency)); $priceCurrency.text(itemCurrency);
            } else {
                $exemptionDetailsSection.slideUp(); $exemptionReasonInput.val(''); $(this).find('.button-text').text('إعفاء'); $(this).removeClass('btn-danger').addClass('btn-warning');
                if(selectedItem && selectedCustomer) fetchAndDisplayPrice(); else { selectedItemPrice = 0; $priceValue.text(format_currency(0, itemCurrency)); }
            }
            updateActionButtonsState();
        });

        $exemptionReasonInput.on('input', updateActionButtonsState);

        function updateActionButtonsState() {
            if (exemption_mode_active) {
                $printButton.prop('disabled', true).hide(); $processExemptionBtn.show();
                if (selectedCustomer && $exemptionReasonInput.val().trim() !== "" && selectedItem) { $processExemptionBtn.prop('disabled', false); }
                else { $processExemptionBtn.prop('disabled', true); }
            } else {
                $processExemptionBtn.prop('disabled', true).hide(); $printButton.show();
                if (selectedCustomer && selectedItem && selectedItemPrice >= 0) { $printButton.prop('disabled', false); }
                else { $printButton.prop('disabled', true); }
            }
        }

        $printButton.click(function() {
            if (!selectedCustomer || !selectedItem) { frappe.show_alert({ message: 'الرجاء اختيار العميل والصنف أولاً.', indicator: 'orange' }); return; }
            $(this).prop('disabled', true).addClass('processing').find('.spinner-border').removeClass('d-none'); $(this).find('.button-text').text('جاري المعالجة...');
            frappe.call({
                method: 'gate_tool.gate_tool.page.bus_exit.bus_exit.create_exit_invoice',
                args: { customer: selectedCustomer, item_code: selectedItem, item_price: selectedItemPrice },
                callback: (r_inv) => { if (r_inv.message && r_inv.message.invoice_name) { print_sales_invoice_receipt(r_inv.message.invoice_name); resetPage(); } else { frappe.show_alert({message: r_inv.message || "خطأ في إنشاء فاتورة الخروج.", indicator: "red"}); }},
                error: (err_inv) => { console.error("Error creating exit invoice:", err_inv); frappe.show_alert({message: "فشل إنشاء فاتورة الخروج.", indicator: "red"}); },
                always: () => { $(this).prop('disabled', false).removeClass('processing').find('.spinner-border').addClass('d-none'); $(this).find('.button-text').text('خروج وطباعة الإيصال'); updateActionButtonsState(); }
            });
        });

        $processExemptionBtn.click(function() {
            const reason = $exemptionReasonInput.val().trim();
            if (!selectedCustomer || !selectedItem || reason === "") { frappe.show_alert({ message: 'الرجاء اختيار العميل، الصنف، وإدخال سبب الإعفاء.', indicator: 'red' }); return; }
            $(this).prop('disabled', true).addClass('processing').find('.spinner-border').removeClass('d-none'); $(this).find('.button-text').text('جاري المعالجة...');
            const exemption_method = 'gate_tool.gate_tool.page.bus_exit.bus_exit.process_bus_exemption';
            const exemption_args = { customer: selectedCustomer, item_code: selectedItem, reason_for_exemption: reason };
            // console.log("Calling frappe.call for exemption with method:", exemption_method, "and args:", exemption_args);
            frappe.call({
                method: exemption_method, args: exemption_args,
                callback: (r_ex) => { if (r_ex.message && r_ex.message.bus_gate_control_docname) { frappe.show_alert({ message: `تم الإعفاء بنجاح. المستند: ${r_ex.message.bus_gate_control_docname}`, indicator: 'green'}); print_bus_gate_control_receipt(r_ex.message.bus_gate_control_docname, reason); resetPageAfterExemption(); } else { frappe.show_alert({message: r_ex.message || "خطأ في معالجة الإعفاء.", indicator: "red"}); console.error("Exemption processing error:", r_ex); }},
                error: (err_ex) => { console.error("Error processing exemption:", err_ex); frappe.show_alert({message: "فشل معالجة الإعفاء.", indicator: "red"}); },
                always: () => { $(this).prop('disabled', false).removeClass('processing').find('.spinner-border').addClass('d-none'); $(this).find('.button-text').text('تأكيد الإعفاء والطباعة'); updateActionButtonsState(); }
            });
        });

        function print_sales_invoice_receipt(invoiceName) {
            if (!gate_tool_settings_data || !gate_tool_settings_data.print_format_exit) { frappe.show_alert({message: "لم يحدد تنسيق طباعة الخروج في الإعدادات.", indicator: "red"}); return; }
            frappe.db.get_doc("Sales Invoice", invoiceName)
                .then(doc => {
                    if (!doc) { console.error("SI not found for printing:", invoiceName); return; }
                    const print_method = "frappe.www.printview.get_html_and_style";
                    const print_args = { doc: doc, print_format: gate_tool_settings_data.print_format_exit, no_letterhead: 0 };
                    // console.log("Calling print for SI:", print_method, print_args);
                    frappe.call({ method: print_method, args: print_args, callback: (pr) => { if(pr.message && pr.message.html){ const pw = window.open('','_blank','width=800,height=600,scrollbars=yes,resizable=yes'); if(pw){pw.document.open(); pw.document.write('<html><head><title>إيصال</title></head><body>'+pr.message.html+'</body></html>'); pw.document.close(); setTimeout(()=>{try{pw.focus();pw.print();}catch(e){console.error(e);}},1000);}else{/*popup blocked*/}}else{/*no html*/}}, error: (e_pr) => {console.error("Print SI err:",e_pr);} });
                }).catch(err => { console.error("Error fetching SI for print:", err); });
        }

        function print_bus_gate_control_receipt(docname, reason_display) {
            if (!gate_tool_settings_data || !gate_tool_settings_data.print_format_exemption) { frappe.show_alert({message: "لم يحدد تنسيق طباعة الإعفاء في الإعدادات.", indicator: "red"}); return; }
            frappe.db.get_doc("Bus Gate control", docname)
                .then(doc_to_print => {
                    if (!doc_to_print) { console.error("BGC doc not found for printing:", docname); return; }
                    // doc_to_print._exemption_reason_display = reason_display; // إذا كنت ستستخدمه في التنسيق
                    const print_method = "frappe.www.printview.get_html_and_style";
                    const print_args = { doc: doc_to_print, print_format: gate_tool_settings_data.print_format_exemption, no_letterhead: 0 };
                    // console.log("Calling print for Exemption:", print_method, print_args);
                    frappe.call({ method: print_method, args: print_args, callback: (pr) => { if(pr.message && pr.message.html){ const pw = window.open('','_blank','width=800,height=600,scrollbars=yes,resizable=yes'); if(pw){pw.document.open(); pw.document.write('<html><head><title>إيصال إعفاء</title></head><body>'+pr.message.html+'</body></html>'); pw.document.close(); setTimeout(()=>{try{pw.focus();pw.print();}catch(e){console.error(e);}},1000);}else{/*popup blocked*/}}else{/*no html*/}}, error: (e_pr_ex) => {console.error("Print Exemption err:",e_pr_ex);} });
                }).catch(err => { console.error("Error fetching BGC for print:", err); });
        }

        function resetPage() {
            selectedItem = null; selectedCustomer = null; selectedItemPrice = 0; exemption_mode_active = false;
            if (customer_field) customer_field.set_value("");
            $selectedCustomerInfo.text('').removeClass('visible');
            $('.item-card-enhanced').removeClass('selected');
            $priceValue.text(format_currency(0, itemCurrency)); $priceCurrency.text(itemCurrency);
            $exemptionDetailsSection.slideUp(); $exemptionReasonInput.val('');
            $toggleExemptionBtn.find('.button-text').text('إعفاء'); $toggleExemptionBtn.removeClass('btn-danger').addClass('btn-warning');
            updateActionButtonsState();
            if ($itemsContainer.scrollTop) $itemsContainer.scrollTop(0);
        }
        function resetPageAfterExemption() { resetPage(); }

        // --- استدعاءات أولية ---
        loadItems();
        updateActionButtonsState();

    } // نهاية render_page_content

    // بدء العملية
    load_and_render_page();
};