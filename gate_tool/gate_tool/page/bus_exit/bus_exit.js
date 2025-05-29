// bus_exit.js
frappe.pages['bus-exit'].on_page_load = function(wrapper_element) {
    // --- إضافة Font Awesome CSS إذا لم تكن موجودة ---
    // هذا يتحقق مما إذا كان هناك بالفعل وسم link أو script يشير إلى fontawesome
    // لتجنب إضافة الرابط عدة مرات.
    if (!$('link[href*="fontawesome"]').length && !$('script[src*="fontawesome"]').length && !$('link[href*="all.min.css"]').length) {
        // استخدام CDN كمثال. يمكنك استبداله بمسار محلي إذا كانت الملفات مستضافة لديك.
        // تأكد من استخدام إصدار متوافق مع Frappe (غالبًا Font Awesome 5.x)
        let fontAwesomeCdnLink = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
        let linkTag = $(`<link rel="stylesheet" href="${fontAwesomeCdnLink}">`);
        $('head').append(linkTag);
        console.log("Font Awesome 5 CSS link added from CDN:", fontAwesomeCdnLink);
    }
    // --- نهاية إضافة Font Awesome ---

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
                    <div id="customer-select-wrapper"></div>
                    <div id="selected-customer-info" class="selected-info-badge"></div>
                </div>

                <div class="section items-selection-section">
                    <label class="section-label">
                        <i class="fas fa-boxes section-icon"></i> 
                        اختر الصنف
                    </label>
                    <div id="items-container-enhanced" class="items-grid-container">
                    </div>
                </div>
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
                <button id="print-exit-enhanced" class="btn btn-primary btn-lg btn-cta" disabled>
                    <span class="button-icon">
                        <i class="fas fa-print button-main-icon"></i>
                    </span>
                    <span class="button-text">خروج وطباعة الإيصال</span>
                    <span class="spinner-border spinner-border-sm d-none" role="status" aria-hidden="true"></span>
                </button>
            </div>
            <div class="global-loader d-none"><div class="spinner-grow" role="status"><span class="sr-only">Loading...</span></div></div>
        </div>
    `;
    wrapper.html(html_content);

    let selectedItem = null;
    let selectedCustomer = null;
    let selectedItemPrice = 0;
    let itemCurrency = frappe.boot.sysdefaults.currency || "USD";

    const $customerSelectWrapper = $('#customer-select-wrapper');
    const $selectedCustomerInfo = $('#selected-customer-info');
    const $itemsContainer = $('#items-container-enhanced');
    const $priceValue = $('#price-value-enhanced');
    const $priceCurrency = $('#price-currency-enhanced');
    const $printButton = $('#print-exit-enhanced');
    const $globalLoader = $('.global-loader');

    let customer_field = frappe.ui.form.make_control({
        df: {
            fieldname: "customer_select_enhanced",
            fieldtype: "Link",
            label: __("Customer"),
            options: "Customer",
            placeholder: __("ابحث عن العميل بالاسم أو الرمز..."),
            onchange: function() {
                selectedCustomer = this.get_value();
                if (selectedCustomer) {
                    frappe.db.get_value("Customer", selectedCustomer, "customer_name", (r) => {
                        if (r && r.customer_name) {
                           $selectedCustomerInfo.text(`العميل: ${r.customer_name}`).addClass('visible');
                        } else {
                           $selectedCustomerInfo.text('العميل محدد').addClass('visible');
                        }
                    });
                } else {
                    $selectedCustomerInfo.text('').removeClass('visible');
                }
                fetchAndDisplayPrice();
                updatePrintButtonState();
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
                    r.message.forEach((item, index) => {
                        let imageUrl = item.image ? item.image : fallbackImageUrl;
                        let card_html = `
                            <div class="item-card-enhanced" data-item-code="${item.name}" data-item-name="${item.item_name || ''}">
                                <img src="${imageUrl}" alt="${item.item_name || 'Item Image'}" onerror="this.onerror=null; this.src='${fallbackImageUrl}';">
                                <div class="item-name">${item.item_name || 'صنف غير مسمى'}</div>
                                <div class="item-code-display">${item.item_code || 'لا يوجد رمز'}</div>
                            </div>
                        `;
                        try {
                            let cardElement = $(card_html);
                            $itemsContainer.append(cardElement);
                        } catch (e) {
                            console.error(`Error creating or appending card for item ${index + 1}:`, e, item);
                        }
                    });
                    $itemsContainer.off('click', '.item-card-enhanced').on('click', '.item-card-enhanced', function() {
                        $('.item-card-enhanced').removeClass('selected');
                        $(this).addClass('selected');
                        selectedItem = $(this).data('item-code');
                        fetchAndDisplayPrice();
                        updatePrintButtonState();
                    });
                } else {
                    $itemsContainer.html('<p class="text-muted text-center" style="grid-column: 1 / -1;">لم يتم العثور على أصناف مطابقة للمجموعة المحددة.</p>');
                }
            },
            error: function(err) {
                console.error("frappe.call for items - ERROR:", err);
                $globalLoader.addClass('d-none');
                $itemsContainer.html('<p class="text-danger text-center" style="grid-column: 1 / -1;">حدث خطأ أثناء تحميل الأصناف.</p>');
            }
        });
    }
    loadItems();

    function fetchAndDisplayPrice() {
        if (selectedItem && selectedCustomer) {
            frappe.call({
                method: 'gate_tool.gate_tool.page.bus_exit.bus_exit.get_price',
                args: {
                    customer: selectedCustomer,
                    item_code: selectedItem
                },
                callback: function(r) {
                    if (r.message) {
                        if (r.message.error) {
                            selectedItemPrice = 0;
                            $priceValue.text('N/A');
                            $priceCurrency.text('');
                            frappe.show_alert({ message: r.message.error, indicator: 'orange' }, 3);
                        } else {
                            selectedItemPrice = parseFloat(r.message.price) || 0;
                            itemCurrency = r.message.currency || frappe.boot.sysdefaults.currency || "USD";
                            $priceValue.text(format_currency(selectedItemPrice, itemCurrency));
                            $priceCurrency.text(itemCurrency);
                        }
                    } else {
                        selectedItemPrice = 0;
                        $priceValue.text('خطأ');
                        $priceCurrency.text('');
                        frappe.show_alert({ message: 'خطأ غير متوقع في جلب السعر.', indicator: 'red' }, 3);
                    }
                    updatePrintButtonState();
                },
                error: function() {
                    selectedItemPrice = 0;
                    $priceValue.text('خطأ');
                    $priceCurrency.text('');
                    frappe.show_alert({ message: 'فشل الاتصال بالخادم لجلب السعر.', indicator: 'red' }, 3);
                    updatePrintButtonState();
                }
            });
        } else {
            selectedItemPrice = 0;
            $priceValue.text(format_currency(0, itemCurrency));
            $priceCurrency.text(itemCurrency);
            updatePrintButtonState();
        }
    }

    function updatePrintButtonState() {
        if (selectedCustomer && selectedItem && selectedItemPrice >= 0) {
            $printButton.prop('disabled', false);
        } else {
            $printButton.prop('disabled', true);
        }
    }

    $printButton.click(function() {
        if (!selectedCustomer || !selectedItem) {
            frappe.show_alert({ message: 'الرجاء اختيار العميل والصنف أولاً.', indicator: 'orange' }, 5);
            return;
        }

        $printButton.prop('disabled', true).addClass('processing');
        $printButton.find('.spinner-border').removeClass('d-none');
        $printButton.find('.button-text').text('جاري المعالجة...');

        frappe.call({
            method: 'gate_tool.gate_tool.page.bus_exit.bus_exit.create_exit_invoice',
            args: {
                customer: selectedCustomer,
                item_code: selectedItem,
                item_price: selectedItemPrice
            },
            callback: function(r) {
                if (r.message && r.message.invoice_name) {
                    const invoiceName = r.message.invoice_name;
                    const busGateControlDocName = r.message.bus_gate_control_docname;

                    frappe.show_alert({
                        message: `تم بنجاح:<br>فاتورة: ${invoiceName}<br>تحكم بوابة: ${busGateControlDocName}`,
                        indicator: 'green'
                    }, 7);

                    frappe.db.get_doc("Sales Invoice", invoiceName)
                        .then(doc => {
                            // console.log("Document to be printed (Sales Invoice) fetched with frappe.db.get_doc:", JSON.parse(JSON.stringify(doc))); // يمكن التعليق عليه
                            if (!doc || !doc.name || !doc.items || !doc.customer) {
                                console.error("Invoice document is missing critical data for printing:", doc);
                                frappe.show_alert({message: "بيانات الفاتورة غير مكتملة للطباعة.", indicator: "red"});
                                return;
                            }
                            frappe.call({
                                method: "frappe.www.printview.get_html_and_style",
                                args: {
                                    doc: doc,
                                    print_format: "Bus Exit Receipt",
                                    no_letterhead: 0
                                },
                                callback: function(print_res) {
                                    // console.log("Print service response (get_html_and_style):", print_res); // يمكن التعليق عليه
                                    if (print_res.message && print_res.message.html && print_res.message.html.trim() !== "") {
                                        const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
                                        if (printWindow) {
                                            // console.log("Print window opened successfully."); // يمكن التعليق عليه
                                            printWindow.document.open();
                                            printWindow.document.write('<html><head><title>إيصال الخروج</title></head><body>');
                                            printWindow.document.write(print_res.message.html);
                                            printWindow.document.write('</body></html>');
                                            printWindow.document.close();
                                            setTimeout(function() {
                                                try {
                                                    // console.log("Attempting to print from print window..."); // يمكن التعليق عليه
                                                    printWindow.focus();
                                                    printWindow.print();
                                                    // console.log("Print command issued to browser."); // يمكن التعليق عليه
                                                } catch (e) {
                                                    console.error("Error during print window operations (e.g., print dialog):", e);
                                                    frappe.show_alert({message: "حدث خطأ أثناء محاولة طباعة الإيصال.", indicator: "red"});
                                                }
                                            }, 1000);
                                        } else {
                                            console.error("Failed to open print window. Pop-up blocker might be active.");
                                            frappe.show_alert({message: "فشل فتح نافذة الطباعة. يرجى التحقق من إعدادات مانع النوافذ المنبثقة.", indicator: "orange"});
                                        }
                                    } else {
                                        frappe.show_alert({ message: 'محتوى الطباعة فارغ أو غير صالح من الخادم.', indicator: 'red' }, 7);
                                        console.error("Print content error from server or empty HTML:", print_res);
                                    }
                                },
                                error: function(print_err) {
                                     frappe.show_alert({ message: 'خطأ في استدعاء خدمة جلب تنسيق الطباعة.', indicator: 'red' }, 7);
                                     console.error("Print service call (get_html_and_style) error:", print_err);
                                }
                            });
                        }).catch(err => {
                            frappe.show_alert({ message: `خطأ في جلب مستند الفاتورة ${invoiceName} للطباعة.`, indicator: 'red' }, 7);
                            console.error(`Error fetching Sales Invoice ${invoiceName} for printing using frappe.db.get_doc:`, err);
                        });
                    resetPage();
                } else if (r.exc) {
                    // الخطأ يظهر تلقائياً
                } else {
                    frappe.show_alert({ message: 'حدث خطأ غير متوقع أثناء إنشاء المستندات.', indicator: 'red' }, 5);
                }
            },
            error: function(err_call) {
                // الخطأ يظهر تلقائياً
            },
            always: function() {
                $printButton.prop('disabled', false).removeClass('processing');
                $printButton.find('.spinner-border').addClass('d-none');
                $printButton.find('.button-text').text('خروج وطباعة الإيصال');
                updatePrintButtonState();
            }
        });
    });

    function resetPage() {
        selectedItem = null;
        selectedItemPrice = 0;

        if (customer_field && typeof customer_field.set_value === 'function') {
             customer_field.set_value("");
        }
        $selectedCustomerInfo.text('').removeClass('visible');
        $('.item-card-enhanced').removeClass('selected');

        itemCurrency = frappe.boot.sysdefaults.currency || "USD";
        $priceValue.text(format_currency(0, itemCurrency));
        $priceCurrency.text(itemCurrency);

        updatePrintButtonState();
        if (typeof $itemsContainer.scrollTop === 'function') {
            $itemsContainer.scrollTop(0);
        }
    }
};