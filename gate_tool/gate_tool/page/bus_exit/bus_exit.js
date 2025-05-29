// bus_exit.js
frappe.pages['bus-exit'].on_page_load = function(wrapper_element) {
    // إضافة Font Awesome CSS إذا لم تكن موجودة
    if (!$('link[href*="fontawesome"]').length && !$('script[src*="fontawesome"]').length && !$('link[href*="all.min.css"]').length) {
        let fontAwesomeCdnLink = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
        let linkTag = $(`<link rel="stylesheet" href="${fontAwesomeCdnLink}">`);
        $('head').append(linkTag);
        // console.log("Font Awesome 5 CSS link added from CDN for bus-exit.");
    }

    let wrapper = $(wrapper_element);
    wrapper.empty().addClass('bus-exit-page-font');

    let html_content = `
        <div class="bus-exit-page-container">
            <div class="page-header">
                <h1 class="page-title">
                    <i class="fas fa-sign-out-alt page-icon-main"></i>
                    تسجيل خروج الباص
                </h1>
            </div>

            <div class="selection-grid">
                <div class="section customer-selection-section">
                    <label for="customer-select-enhanced" class="section-label">
                        <i class="fas fa-id-card section-icon"></i>
                        اختر العميل (السيارة)
                    </label>
                    <div id="customer-select-wrapper-exit"></div>
                    <div id="selected-customer-info-exit" class="selected-info-badge"></div>
                </div>

                <div class="section items-selection-section">
                    <label class="section-label">
                        <i class="fas fa-boxes section-icon"></i>
                        اختر الصنف
                    </label>
                    <div id="items-container-enhanced-exit" class="items-grid-container"></div>
                </div>
            </div>

            <div id="exemption-details-section" class="section" style="display: none; margin-top: 20px; border-color: var(--warning-color);">
                <label for="exemption-reason" class="section-label" style="color: var(--warning-color);">
                    <i class="fas fa-file-alt section-icon"></i>
                    سبب الإعفاء (إجباري عند الإعفاء)
                </label>
                <textarea id="exemption-reason" class="form-control" rows="3" placeholder="أدخل سبب الإعفاء هنا..."></textarea>
            </div>

            <div class="summary-and-action-section">
                <div class="price-display-container">
                    <span class="price-label-text">
                        <i class="fas fa-cash-register price-icon"></i>
                        الإجمالي:
                    </span>
                    <span id="price-value-enhanced" class="price-value">0.00</span>
                    <span id="price-currency-enhanced" class="price-currency"></span>
                </div>

                <div class="action-buttons-group" style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;">
                    <button id="print-exit-enhanced" class="btn btn-primary btn-lg btn-cta">
                        <span class="button-icon"><i class="fas fa-receipt button-main-icon"></i></span>
                        <span class="button-text">خروج وطباعة الإيصال</span>
                        <span class="spinner-border spinner-border-sm d-none" role="status" aria-hidden="true"></span>
                    </button>
                    <button id="process-exemption-btn" class="btn btn-success btn-lg btn-cta" style="display: none;">
                        <i class="fas fa-check-circle"></i>
                        <span class="button-text">تأكيد الإعفاء والطباعة</span>
                         <span class="spinner-border spinner-border-sm d-none" role="status" aria-hidden="true"></span>
                    </button>
                    <button id="toggle-exemption-btn" class="btn btn-warning btn-lg">
                        <i class="fas fa-shield-alt"></i> <span class="button-text">إعفاء</span>
                    </button>
                </div>
            </div>
            <div class="global-loader d-none"><div class="spinner-grow" role="status"></div></div>
        </div>
    `;
    wrapper.html(html_content);

    let selectedItem = null;
    let selectedCustomer = null;
    let selectedItemPrice = 0;
    let itemCurrency = frappe.boot.sysdefaults.currency || "USD";
    let exemption_mode_active = false;

    const $customerSelectWrapper = $('#customer-select-wrapper-exit');
    const $selectedCustomerInfo = $('#selected-customer-info-exit');
    const $itemsContainer = $('#items-container-enhanced-exit');
    const $priceValue = $('#price-value-enhanced');
    const $priceCurrency = $('#price-currency-enhanced');
    const $printButton = $('#print-exit-enhanced');
    const $globalLoader = $('.global-loader');
    const $toggleExemptionBtn = $('#toggle-exemption-btn');
    const $exemptionDetailsSection = $('#exemption-details-section');
    const $exemptionReasonInput = $('#exemption-reason');
    const $processExemptionBtn = $('#process-exemption-btn');

    let customer_field = frappe.ui.form.make_control({
        df: {
            fieldname: "customer_select_exit",
            fieldtype: "Link",
            label: __("Customer"),
            options: "Customer",
            reqd: 1,
            placeholder: __("ابحث عن العميل..."),
            onchange: function() {
                selectedCustomer = this.get_value();
                if (selectedCustomer) {
                    frappe.db.get_value("Customer", selectedCustomer, "customer_name", (r) => {
                        $selectedCustomerInfo.text(`العميل: ${r.customer_name || selectedCustomer}`).addClass('visible');
                    });
                    if (selectedItem && !exemption_mode_active) fetchAndDisplayPrice();
                } else {
                    $selectedCustomerInfo.text('').removeClass('visible');
                    selectedItemPrice = 0;
                    $priceValue.text(format_currency(0, itemCurrency));
                }
                updateActionButtonsState();
            }
        },
        parent: $customerSelectWrapper,
        render_label: false
    });
    customer_field.refresh();

    function loadItems() {
        $globalLoader.removeClass('d-none');
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Item',
                fields: ['name', 'item_name', 'image', 'item_code'],
                filters: { 'item_group': 'Bus Gate Control' },
                limit_page_length: 100
            },
            callback: function(r) {
                $globalLoader.addClass('d-none');
                $itemsContainer.empty();
                if (r.message && r.message.length > 0) {
                    const fallbackImageUrl = '/assets/frappe/images/fallback-image.svg';
                    r.message.forEach((item) => {
                        let imageUrl = item.image ? item.image : fallbackImageUrl;
                        let card_html = `
                            <div class="item-card-enhanced" data-item-code="${item.name}" data-item-name="${item.item_name || ''}">
                                <img src="${imageUrl}" alt="${item.item_name || 'Item Image'}" onerror="this.onerror=null; this.src='${fallbackImageUrl}';">
                                <div class="item-name">${item.item_name || 'صنف غير مسمى'}</div>
                                <div class="item-code-display">${item.item_code || 'لا يوجد رمز'}</div>
                            </div>
                        `;
                        $itemsContainer.append(card_html);
                    });
                    $itemsContainer.off('click', '.item-card-enhanced').on('click', '.item-card-enhanced', function() {
                        $('.item-card-enhanced').removeClass('selected');
                        $(this).addClass('selected');
                        selectedItem = $(this).data('item-code');
                        if (selectedCustomer && !exemption_mode_active) fetchAndDisplayPrice();
                        else if (exemption_mode_active) $priceValue.text(format_currency(0, itemCurrency));
                        updateActionButtonsState();
                    });
                } else {
                    $itemsContainer.html('<p class="text-muted text-center">لا توجد أصناف.</p>');
                }
                updateActionButtonsState();
            },
            error: (err) => { $globalLoader.addClass('d-none'); console.error("Error loading items:", err); $itemsContainer.html('<p class="text-danger text-center">خطأ في تحميل الأصناف.</p>');}
        });
    }
    loadItems();

    function fetchAndDisplayPrice() {
        if (selectedItem && selectedCustomer && !exemption_mode_active) {
            frappe.call({
                method: 'gate_tool.gate_tool.page.bus_exit.bus_exit.get_price',
                args: { customer: selectedCustomer, item_code: selectedItem },
                callback: function(r) {
                    if (r.message) {
                        if (r.message.error) {
                            selectedItemPrice = 0; $priceValue.text('N/A'); $priceCurrency.text('');
                            frappe.show_alert({ message: r.message.error, indicator: 'orange' }, 3);
                        } else {
                            selectedItemPrice = parseFloat(r.message.price) || 0;
                            itemCurrency = r.message.currency || frappe.boot.sysdefaults.currency || "USD";
                            $priceValue.text(format_currency(selectedItemPrice, itemCurrency));
                            $priceCurrency.text(itemCurrency);
                        }
                    } else { selectedItemPrice = 0; $priceValue.text('خطأ'); $priceCurrency.text(''); }
                    updateActionButtonsState();
                },
                error: (err_price) => { selectedItemPrice = 0; $priceValue.text('خطأ'); console.error("Error fetching price:", err_price); updateActionButtonsState(); }
            });
        } else if (exemption_mode_active) {
            selectedItemPrice = 0;
            $priceValue.text(format_currency(0, itemCurrency));
            updateActionButtonsState();
        } else {
            selectedItemPrice = 0;
            $priceValue.text(format_currency(0, itemCurrency));
            updateActionButtonsState();
        }
    }

    $toggleExemptionBtn.click(function() {
        exemption_mode_active = !exemption_mode_active;
        if (exemption_mode_active) {
            $exemptionDetailsSection.slideDown();
            $(this).find('.button-text').text('إلغاء الإعفاء');
            $(this).removeClass('btn-warning').addClass('btn-danger');
            $printButton.hide();
            $processExemptionBtn.show();
            selectedItemPrice = 0;
            $priceValue.text(format_currency(0, itemCurrency));
            $priceCurrency.text(itemCurrency);
        } else {
            $exemptionDetailsSection.slideUp();
            $exemptionReasonInput.val('');
            $(this).find('.button-text').text('إعفاء');
            $(this).removeClass('btn-danger').addClass('btn-warning');
            $printButton.show();
            $processExemptionBtn.hide();
            if(selectedItem && selectedCustomer) fetchAndDisplayPrice();
            else { selectedItemPrice = 0; $priceValue.text(format_currency(0, itemCurrency)); }
        }
        updateActionButtonsState();
    });

    $exemptionReasonInput.on('input', updateActionButtonsState);

    function updateActionButtonsState() {
        if (exemption_mode_active) {
            $printButton.prop('disabled', true).hide(); // إخفاء زر الخروج العادي
            $processExemptionBtn.show(); // إظهار زر الإعفاء
            if (selectedCustomer && $exemptionReasonInput.val().trim() !== "" && selectedItem) { // الصنف إجباري في الإعفاء
                $processExemptionBtn.prop('disabled', false);
            } else {
                $processExemptionBtn.prop('disabled', true);
            }
        } else {
            $processExemptionBtn.prop('disabled', true).hide(); // إخفاء زر الإعفاء
            $printButton.show(); // إظهار زر الخروج العادي
            if (selectedCustomer && selectedItem && selectedItemPrice >= 0) {
                $printButton.prop('disabled', false);
            } else {
                $printButton.prop('disabled', true);
            }
        }
    }
    updateActionButtonsState();

    // زر الخروج العادي
    $printButton.click(function() {
        if (!selectedCustomer || !selectedItem) {
            frappe.show_alert({ message: 'الرجاء اختيار العميل والصنف أولاً.', indicator: 'orange' });
            return;
        }
        $(this).prop('disabled', true).addClass('processing');
        $(this).find('.spinner-border').removeClass('d-none');
        $(this).find('.button-text').text('جاري المعالجة...');

        frappe.call({
            method: 'gate_tool.gate_tool.page.bus_exit.bus_exit.create_exit_invoice',
            args: { customer: selectedCustomer, item_code: selectedItem, item_price: selectedItemPrice },
            callback: function(r_inv) {
                if (r_inv.message && r_inv.message.invoice_name) {
                    print_sales_invoice_receipt(r_inv.message.invoice_name);
                    resetPage();
                } else { frappe.show_alert({message: r_inv.message || "خطأ في إنشاء فاتورة الخروج.", indicator: "red"}); }
            },
            error: (err_inv) => { console.error("Error creating exit invoice:", err_inv); frappe.show_alert({message: "فشل إنشاء فاتورة الخروج.", indicator: "red"}); },
            always: () => {
                $printButton.prop('disabled', false).removeClass('processing');
                $printButton.find('.spinner-border').addClass('d-none');
                $printButton.find('.button-text').text('خروج وطباعة الإيصال');
                updateActionButtonsState();
            }
        });
    });

    // زر تأكيد الإعفاء
    $processExemptionBtn.click(function() {
        const reason = $exemptionReasonInput.val().trim();
        if (!selectedCustomer || !selectedItem || reason === "") {
            frappe.show_alert({ message: 'الرجاء اختيار العميل، الصنف، وإدخال سبب الإعفاء.', indicator: 'red' });
            return;
        }
        $(this).prop('disabled', true).addClass('processing');
        $(this).find('.spinner-border').removeClass('d-none');
        $(this).find('.button-text').text('جاري المعالجة...');

        const exemption_method = 'gate_tool.gate_tool.page.bus_exit.bus_exit.process_bus_exemption';
        const exemption_args = { customer: selectedCustomer, item_code: selectedItem, reason_for_exemption: reason };
        console.log("Calling frappe.call for exemption with method:", exemption_method, "and args:", exemption_args);

        frappe.call({
            method: exemption_method,
            args: exemption_args,
            callback: function(r_ex) {
                if (r_ex.message && r_ex.message.bus_gate_control_docname) {
                    frappe.show_alert({ message: `تم الإعفاء بنجاح. المستند: ${r_ex.message.bus_gate_control_docname}`, indicator: 'green'});
                    print_bus_gate_control_receipt(r_ex.message.bus_gate_control_docname, reason);
                    resetPageAfterExemption();
                } else { frappe.show_alert({message: r_ex.message || "خطأ في معالجة الإعفاء.", indicator: "red"}); console.error("Exemption processing error:", r_ex); }
            },
            error: (err_ex) => { console.error("Error processing exemption:", err_ex); frappe.show_alert({message: "فشل معالجة الإعفاء.", indicator: "red"}); },
            always: () => {
                $processExemptionBtn.prop('disabled', false).removeClass('processing');
                $processExemptionBtn.find('.spinner-border').addClass('d-none');
                $processExemptionBtn.find('.button-text').text('تأكيد الإعفاء والطباعة');
                updateActionButtonsState();
            }
        });
    });

// bus_exit.js
// ...

function print_sales_invoice_receipt(invoiceName) {
    console.log(`[PRINT_SI] Attempting to print Sales Invoice: ${invoiceName}`);

    frappe.db.get_doc("Sales Invoice", invoiceName)
        .then(doc_to_print => {
            if (!doc_to_print) {
                console.error(`[PRINT_SI] Document ${invoiceName} not found for printing.`);
                frappe.show_alert({ message: `فشل جلب الفاتورة ${invoiceName} للطباعة.`, indicator: "red" });
                return;
            }
            console.log("[PRINT_SI] Document fetched successfully:", JSON.parse(JSON.stringify(doc_to_print)));

            const print_method_name = "frappe.www.printview.get_html_and_style";
            const print_format_name = "Bus Exit Receipt"; //  *** تأكد من أن هذا الاسم دقيق 100% ***

            let print_args_obj = {
                doc: doc_to_print, // كائن المستند الكامل
                print_format: print_format_name,
                no_letterhead: 0 // أو 1
            };

            console.log("[PRINT_SI] Calling frappe.call with:", { method: print_method_name, args: print_args_obj });

            frappe.call({
                method: print_method_name,
                args: print_args_obj,
                callback: function(print_res) {
                    console.log("[PRINT_SI] Response from print service:", print_res);
                    if (print_res.message && print_res.message.html && print_res.message.html.trim() !== "") {
                        const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
                        if (printWindow) {
                            printWindow.document.open();
                            printWindow.document.write('<html><head><title>إيصال خروج</title></head><body>' + print_res.message.html + '</body></html>');
                            printWindow.document.close();
                            setTimeout(() => {
                                try {
                                    printWindow.focus();
                                    printWindow.print();
                                } catch (e) {
                                    console.error("[PRINT_SI] Error during printWindow.print():", e);
                                    frappe.show_alert({ message: "حدث خطأ أثناء محاولة طباعة الإيصال.", indicator: "red" });
                                }
                                // setTimeout(() => { printWindow.close(); }, 7000);
                            }, 1000);
                        } else {
                            frappe.show_alert({ message: "فشل فتح نافذة الطباعة. تحقق من مانع النوافذ المنبثقة.", indicator: "orange" });
                        }
                    } else {
                        frappe.show_alert({ message: 'محتوى طباعة الفاتورة فارغ أو غير صالح.', indicator: 'red' });
                        console.error("[PRINT_SI] Empty or invalid print content:", print_res);
                    }
                },
                error: function(err_print_service) {
                    console.error("[PRINT_SI] Error calling print service:", err_print_service);
                    frappe.show_alert({ message: 'خطأ في خدمة طباعة الفاتورة.', indicator: 'red' });
                }
            });
        })
        .catch(err_get_doc => {
            console.error(`[PRINT_SI] Error fetching document ${invoiceName} for printing:`, err_get_doc);
            frappe.show_alert({ message: `فشل جلب الفاتورة ${invoiceName} للطباعة.`, indicator: "red" });
        });
}

    function print_bus_gate_control_receipt(docname, exemption_reason_display) {
        frappe.db.get_doc("Bus Gate control", docname)
            .then(doc_to_print => {
                if (!doc_to_print) { console.error("Bus Gate Control doc not found for printing:", docname); return; }
                // doc_to_print._exemption_reason_display = exemption_reason_display; // يمكن إضافته إذا لزم الأمر في التنسيق
                const print_method = "frappe.www.printview.get_html_and_style";
                const print_args = { doc: doc_to_print, print_format: "Bus Exemption Receipt", no_letterhead: 0 };
                console.log("Calling frappe.call for Exemption print with method:", print_method, "and args:", print_args);

                frappe.call({
                    method: print_method,
                    args: print_args,
                    callback: function(print_res) {
                        if (print_res.message && print_res.message.html && print_res.message.html.trim() !== "") {
                            const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
                            if (printWindow) {
                                printWindow.document.open();
                                printWindow.document.write('<html><head><title>إيصال إعفاء</title></head><body>' + print_res.message.html + '</body></html>');
                                printWindow.document.close();
                                setTimeout(() => { try { printWindow.focus(); printWindow.print(); } catch (e) { console.error("Print error:", e); }}, 1000);
                            } else { frappe.show_alert({message: "فشل فتح نافذة الطباعة.", indicator: "orange"}); }
                        } else { frappe.show_alert({message: 'محتوى طباعة الإعفاء فارغ.', indicator: 'red'}); console.error("Empty print content for exemption:", print_res); }
                    },
                    error: (err_p_ex) => { console.error("Print service error (Exemption):", err_p_ex); frappe.show_alert({message: 'خطأ في خدمة طباعة الإعفاء.', indicator: 'red'}); }
                });
            })
            .catch(err => { console.error("Error fetching BGC for print:", err); });
    }

    function resetPage() {
        selectedItem = null;
        selectedCustomer = null;
        selectedItemPrice = 0;
        exemption_mode_active = false;

        if (customer_field) customer_field.set_value("");
        $selectedCustomerInfo.text('').removeClass('visible');
        $('.item-card-enhanced').removeClass('selected');
        $priceValue.text(format_currency(0, itemCurrency));
        $priceCurrency.text(itemCurrency);

        $exemptionDetailsSection.slideUp(); // التأكد من إخفائه
        $exemptionReasonInput.val('');
        $toggleExemptionBtn.find('.button-text').text('إعفاء');
        $toggleExemptionBtn.removeClass('btn-danger').addClass('btn-warning');
        // $printButton.show(); // يتم التحكم به بواسطة updateActionButtonsState
        // $processExemptionBtn.hide(); // يتم التحكم به بواسطة updateActionButtonsState
        updateActionButtonsState(); // استدعاء لتحديث حالة الأزرار بشكل صحيح
        if ($itemsContainer.scrollTop) $itemsContainer.scrollTop(0);
    }
    function resetPageAfterExemption() {
        resetPage();
    }
};