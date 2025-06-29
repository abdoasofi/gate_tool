// bus_entry.js
frappe.pages['bus-entry'].on_page_load = function(wrapper_element) {
    // إضافة Font Awesome CSS إذا لم تكن موجودة
    if (!$('link[href*="fontawesome"]').length && !$('script[src*="fontawesome"]').length && !$('link[href*="all.min.css"]').length) {
        let fontAwesomeCdnLink = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
        let linkTag = $(`<link rel="stylesheet" href="${fontAwesomeCdnLink}">`);
        $('head').append(linkTag);
    }

    let wrapper = $(wrapper_element);
    wrapper.empty().addClass('bus-exit-page-font'); // استخدام نفس الكلاس لإعادة استخدام CSS

    let gate_tool_settings_data = null;

    // متغيرات على مستوى on_page_load
    let selectedItem = null;
    let selectedCustomer = null;

    // الدالة الرئيسية: جلب الإعدادات ثم بناء الواجهة
    function load_and_render_page() {
        frappe.call({
            method: "frappe.client.get",
            args: { doctype: "Gate Tool Settings", name: "Gate Tool Settings" },
            callback: function(r_settings) {
                if (r_settings.message) {
                    gate_tool_settings_data = r_settings.message;
                    console.log("Gate Tool Settings loaded for Entry page:", gate_tool_settings_data);
                    render_page_content();
                } else {
                    frappe.throw("لم يتم تحميل إعدادات Gate Tool.");
                }
            },
            error: function(err_settings) {
                console.error("Error loading Gate Tool Settings:", err_settings);
                frappe.throw("خطأ فادح: لا يمكن تحميل إعدادات Gate Tool.");
            }
        });
    }

    // دالة بناء الواجهة وربط الأحداث
    function render_page_content() {
        let page_title_text = "تسجيل دخول الباص";
        let button_text_main = "تسجيل الدخول";
        let button_icon_main = "fas fa-sign-in-alt";

        let html_content = `
            <div class="bus-exit-page-container">
                <div class="page-header">
                    <h1 class="page-title"><i class="fas fa-door-open page-icon-main"></i> ${page_title_text}</h1>
                </div>
                <div class="selection-grid">
                    <div class="section customer-selection-section">
                        <label class="section-label"><i class="fas fa-bus section-icon"></i> اختر نوع السيارة</label>
                        <div id="customer-buttons-wrapper-entry" class="customer-buttons-container">
                        </div>
                        <div id="selected-customer-info-entry" class="selected-info-badge"></div>
                    </div>
                    <div class="section items-selection-section">
                        <label class="section-label"><i class="fas fa-boxes section-icon"></i> اختر الخدمة عند الدخول (اختياري)</label>
                        <div id="items-container-enhanced-entry" class="items-grid-container">
                            <p class="text-muted text-center">الرجاء اختيار نوع السيارة أولاً لعرض الأصناف.</p>
                        </div>
                    </div>
                </div>
                <div class="summary-and-action-section">
                    <button id="process-entry-btn" class="btn btn-success btn-lg btn-cta">
                        <span class="button-icon"><i class="${button_icon_main} button-main-icon"></i></span>
                        <span class="button-text">${button_text_main}</span>
                        <span class="spinner-border spinner-border-sm d-none" role="status" aria-hidden="true"></span>
                    </button>
                </div>
                <div class="global-loader d-none"><div class="spinner-grow" role="status"></div></div>
            </div>
        `;
        wrapper.html(html_content);

        // تعريف عناصر jQuery
        const $customerButtonsWrapper = wrapper.find('#customer-buttons-wrapper-entry');
        const $selectedCustomerInfo = wrapper.find('#selected-customer-info-entry');
        const $itemsContainer = wrapper.find('#items-container-enhanced-entry');
        const $processButton = wrapper.find('#process-entry-btn');
        const $globalLoader = wrapper.find('.global-loader');

        // إضافة أزرار العملاء من الإعدادات
        if (gate_tool_settings_data.customer_microbus) {
            let btn_microbus = $(`<button class="btn customer-type-btn" data-customer-id="${gate_tool_settings_data.customer_microbus}"><i class="fas fa-shuttle-van"></i> مايكروباص</button>`);
            $customerButtonsWrapper.append(btn_microbus);
        }
        if (gate_tool_settings_data.customer_bus) {
            let btn_bus = $(`<button class="btn customer-type-btn" data-customer-id="${gate_tool_settings_data.customer_bus}"><i class="fas fa-bus-alt"></i> باص</button>`);
            $customerButtonsWrapper.append(btn_bus);
        }

        // --- الدوال المساعدة وربط الأحداث ---

        function selectCustomer(customer_id, customer_name) {
            selectedCustomer = customer_id;
            selectedItem = null;
            $('.item-card-enhanced').removeClass('selected');
            $selectedCustomerInfo.text(` ${customer_name || customer_id}`).addClass('visible');

            frappe.db.get_value("Customer", customer_id, "custom_item_group")
                .then(r => {
                    if (r && r.message && r.message.custom_item_group) {
                        loadItems(r.message.custom_item_group);
                    } else {
                        console.log(`Customer ${customer_id} has no custom item group.`);
                        $itemsContainer.html('<p class="text-danger text-center">لم يتم تحديد مجموعة أصناف لهذا العميل.</p>');
                    }
                })
                .catch(err => {
                    console.error("Error fetching custom_item_group:", err);
                    $itemsContainer.html('<p class="text-danger text-center">خطأ في جلب مجموعة الأصناف للعميل.</p>');
                });
            
            updateProcessButtonState();
        }

        function loadItems(item_group) {
            if (!item_group) {
                $itemsContainer.html('<p class="text-muted text-center">يرجى اختيار العميل أولاً.</p>');
                return;
            }
            $itemsContainer.html('<div class="d-flex justify-content-center mt-5"><div class="spinner-border text-primary" role="status"><span class="sr-only">Loading...</span></div></div>');
            
            frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Item', fields: ['name', 'item_name', 'image', 'item_code'],
                    filters: { 'item_group': item_group },
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
                            $('.item-card-enhanced').removeClass('selected');
                            $(this).addClass('selected');
                            selectedItem = $(this).data('item-code');
                            updateProcessButtonState(); // لا حاجة لتحديث السعر هنا
                        });
                    } else {
                        $itemsContainer.html('<p class="text-muted text-center">لا توجد أصناف في هذه المجموعة.</p>');
                    }
                },
                error: (err_items) => { console.error("Error loading items:", err_items); $itemsContainer.html('<p class="text-danger text-center">خطأ في تحميل الأصناف.</p>'); }
            });
        }
        
        $customerButtonsWrapper.on('click', '.customer-type-btn', function() {
            const customer_id = $(this).data('customer-id');
            const customer_name_text = $(this).text().trim();
            $('.customer-type-btn').removeClass('active btn-primary').addClass('btn-secondary');
            $(this).removeClass('btn-secondary').addClass('active btn-primary');
            selectCustomer(customer_id, customer_name_text);
        });
        
        function updateProcessButtonState() {
            // العميل مطلوب، الصنف اختياري
            if (selectedCustomer) {
                $processButton.prop('disabled', false);
            } else {
                $processButton.prop('disabled', true);
            }
        }

        $processButton.click(function() {
            if (!selectedCustomer) {
                frappe.show_alert({ message: 'الرجاء اختيار العميل (السيارة) أولاً.', indicator: 'orange' }, 5);
                return;
            }

            $(this).prop('disabled', true).addClass('processing');
            $(this).find('.spinner-border').removeClass('d-none');
            $(this).find('.button-text').text('جاري التسجيل...');

            let doc_data = {
                doctype: "Bus Gate control",
                customer: selectedCustomer,
                status: "Entered",
            };
            if (selectedItem) {
                doc_data.item = selectedItem;
            }

            frappe.call({
                method: 'frappe.client.insert',
                args: { doc: JSON.stringify(doc_data) },
                callback: function(insert_response) {
                    if (insert_response.message && insert_response.message.name) {
                        const created_doc_data = insert_response.message;
                        frappe.show_alert({ message: `تم تسجيل دخول العميل بنجاح. المستند: ${created_doc_data.name}`, indicator: 'green' }, 7);
                        
                        frappe.call({
                            method: "frappe.client.submit",
                            args: { doc: JSON.stringify(created_doc_data) },
                            callback: (submit_res) => { /* console.log("Submitted:", submit_res.message.name); */ },
                            error: (submit_err) => { console.error("Submit Error:", submit_err); frappe.show_alert({message: "تم الإنشاء ولكن فشل الإرسال.", indicator: "orange"}); },
                            always: () => { resetEntryPage(); }
                        });
                    } else {
                         // إذا فشل الإنشاء، أعد تمكين الزر هنا
                         frappe.show_alert({ message: 'حدث خطأ أثناء تسجيل الدخول.', indicator: 'red' }, 5);
                         $processButton.prop('disabled', false).removeClass('processing').find('.spinner-border').addClass('d-none');
                         $processButton.find('.button-text').text(button_text_main);
                    }
                },
                error: function(insert_err) {
                    // إذا فشل استدعاء الإنشاء، أعد تمكين الزر هنا
                     frappe.show_alert({ message: 'فشل الاتصال بالخادم.', indicator: 'red' }, 5);
                     $processButton.prop('disabled', false).removeClass('processing').find('.spinner-border').addClass('d-none');
                     $processButton.find('.button-text').text(button_text_main);
                }
            });
        });

        function resetEntryPage() {
            selectedItem = null;
            selectedCustomer = null;
            $('.customer-type-btn').removeClass('active btn-primary').addClass('btn-secondary');
            $selectedCustomerInfo.text('').removeClass('visible');
            $itemsContainer.html('<p class="text-muted text-center">الرجاء اختيار نوع السيارة أولاً لعرض الأصناف.</p>');
            
            // إعادة تعيين الزر الرئيسي (كان يتم في always الخاص بـ submit)
            $processButton.prop('disabled', false).removeClass('processing');
            $processButton.find('.spinner-border').addClass('d-none');
            $processButton.find('.button-text').text(button_text_main);
            
            updateProcessButtonState();
        }

        // --- الإعداد الافتراضي ---
        if (gate_tool_settings_data.customer_microbus) {
            $customerButtonsWrapper.find(`[data-customer-id="${gate_tool_settings_data.customer_microbus}"]`).trigger('click');
        } else {
            updateProcessButtonState();
        }

    } // نهاية render_page_content

    // بدء العملية
    load_and_render_page();
};