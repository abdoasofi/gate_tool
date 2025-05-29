// bus_entry.js
frappe.pages['bus-entry'].on_page_load = function(wrapper_element) {
    // إضافة Font Awesome CSS إذا لم تكن موجودة
    if (!$('link[href*="fontawesome"]').length && !$('script[src*="fontawesome"]').length && !$('link[href*="all.min.css"]').length) {
        let fontAwesomeCdnLink = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
        let linkTag = $(`<link rel="stylesheet" href="${fontAwesomeCdnLink}">`);
        $('head').append(linkTag);
        // console.log("Font Awesome 5 CSS link added from CDN for bus-entry.");
    }

    let wrapper = $(wrapper_element);
    wrapper.empty().addClass('bus-exit-page-font');

    let page_title_text = "تسجيل دخول الباص";
    let button_text_main = "تسجيل الدخول";
    let button_icon_main = "fas fa-sign-in-alt";

    let html_content = `
        <div class="bus-exit-page-container">
            <div class="page-header">
                <h1 class="page-title">
                    <i class="fas fa-door-open page-icon-main"></i>
                    ${page_title_text}
                </h1>
            </div>

            <div class="selection-grid">
                <div class="section customer-selection-section">
                    <label for="customer-select-enhanced" class="section-label">
                        <i class="fas fa-id-card section-icon"></i>
                        اختر العميل (السيارة)
                    </label>
                    <div id="customer-select-wrapper-entry"></div>
                    <div id="selected-customer-info-entry" class="selected-info-badge"></div>
                </div>

                <div class="section items-selection-section">
                    <label class="section-label">
                        <i class="fas fa-boxes section-icon"></i>
                        اختر الصنف (نوع الخدمة عند الدخول - اختياري)
                    </label>
                    <div id="items-container-enhanced-entry" class="items-grid-container"></div>
                </div>
            </div>

            <div class="summary-and-action-section">
                <button id="process-entry-btn" class="btn btn-success btn-lg btn-cta">
                    <span class="button-icon">
                        <i class="${button_icon_main} button-main-icon"></i>
                    </span>
                    <span class="button-text">${button_text_main}</span>
                    <span class="spinner-border spinner-border-sm d-none" role="status" aria-hidden="true"></span>
                </button>
            </div>
            <div class="global-loader d-none"><div class="spinner-grow" role="status"><span class="sr-only">Loading...</span></div></div>
        </div>
    `;
    wrapper.html(html_content);

    let selectedItem = null;
    let selectedCustomer = null;

    const $customerSelectWrapper = $('#customer-select-wrapper-entry');
    const $selectedCustomerInfo = $('#selected-customer-info-entry');
    const $itemsContainer = $('#items-container-enhanced-entry');
    const $processButton = $('#process-entry-btn');
    const $globalLoader = $('.global-loader');

    let customer_field = frappe.ui.form.make_control({
        df: {
            fieldname: "customer_select_entry",
            fieldtype: "Link",
            label: __("Customer"),
            options: "Customer",
            reqd: 1,
            placeholder: __("ابحث عن العميل (السيارة)..."),
            onchange: function() {
                selectedCustomer = this.get_value();
                if (selectedCustomer) {
                    frappe.db.get_value("Customer", selectedCustomer, "customer_name", (r) => {
                        $selectedCustomerInfo.text(`العميل: ${r.customer_name || selectedCustomer}`).addClass('visible');
                    });
                } else {
                    $selectedCustomerInfo.text('').removeClass('visible');
                }
                updateProcessButtonState();
            }
        },
        parent: $customerSelectWrapper,
        render_label: false
    });
    customer_field.refresh();

    function loadEntryItems() {
        $globalLoader.removeClass('d-none');
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Item',
                fields: ['name', 'item_name', 'image', 'item_code'],
                filters: { 'item_group': 'Bus Gate Control' }, // استخدام نفس مجموعة الخروج
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
                        updateProcessButtonState();
                    });
                } else {
                    $itemsContainer.html('<p class="text-muted text-center" style="grid-column: 1 / -1;">لا توجد أصناف/خدمات متاحة للدخول حاليًا.</p>');
                }
                 updateProcessButtonState();
            },
            error: function() {
                $globalLoader.addClass('d-none');
                $itemsContainer.html('<p class="text-danger text-center">خطأ في تحميل الأصناف.</p>');
                 updateProcessButtonState();
            }
        });
    }
    loadEntryItems();

    function updateProcessButtonState() {
        if (selectedCustomer /* && selectedItem */) { // إذا كان الصنف إجباريًا، أزل التعليق
            $processButton.prop('disabled', false);
        } else {
            $processButton.prop('disabled', true);
        }
    }
    updateProcessButtonState();

    $processButton.click(function() {
        if (!selectedCustomer) {
            frappe.show_alert({ message: 'الرجاء اختيار العميل (السيارة) أولاً.', indicator: 'orange' }, 5);
            return;
        }

        $processButton.prop('disabled', true).addClass('processing');
        $processButton.find('.spinner-border').removeClass('d-none');
        $processButton.find('.button-text').text('جاري التسجيل...');

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
            args: {
                doc: JSON.stringify(doc_data)
            },
            callback: function(insert_response) {
                if (insert_response.message && insert_response.message.name) {
                    const new_doc_name = insert_response.message.name;
                    const created_doc_data = insert_response.message; // المستند المُنشأ

                    frappe.show_alert({
                        message: `تم تسجيل دخول العميل ${selectedCustomer} بنجاح. المستند: ${new_doc_name}`,
                        indicator: 'green'
                    }, 7);

                    // إرسال المستند
                    frappe.call({
                        method: "frappe.client.submit",
                        args: {
                            doc: JSON.stringify(created_doc_data) // تمرير المستند المُنشأ
                        },
                        callback: function(submit_res) {
                            if (submit_res.message && submit_res.message.name) {
                                console.log("Bus Gate Control document submitted:", submit_res.message.name);
                                frappe.show_alert({message: `تم إرسال مستند التحكم ${submit_res.message.name} بنجاح.`, indicator: "green"}, 5);
                            } else {
                                console.error("Submission response did not contain expected data:", submit_res);
                                frappe.show_alert({message: "تم إنشاء مستند التحكم ولكن حدث خطأ غير متوقع أثناء محاولة الإرسال.", indicator: "orange"});
                            }
                        },
                        error: function(submit_err) {
                            console.error("Error submitting Bus Gate Control document:", submit_err);
                            // رسالة الخطأ من الخادم ستظهر تلقائياً
                        },
                        always: function() {
                            // إعادة تعيين الصفحة بعد محاولة الإرسال (سواء نجحت أو فشلت)
                            resetEntryPage();
                            // إعادة تمكين زر الإنشاء الرئيسي (زر الدخول)
                            $processButton.prop('disabled', false).removeClass('processing');
                            $processButton.find('.spinner-border').addClass('d-none');
                            $processButton.find('.button-text').text(button_text_main);
                            updateProcessButtonState();
                        }
                    });
                } else {
                    frappe.show_alert({ message: 'حدث خطأ أثناء تسجيل الدخول (إنشاء المستند).', indicator: 'red' }, 5);
                    console.error("Error creating Bus Gate Control (no name in response):", insert_response);
                    // إعادة تمكين الزر إذا فشل الإنشاء الأولي
                    $processButton.prop('disabled', false).removeClass('processing');
                    $processButton.find('.spinner-border').addClass('d-none');
                    $processButton.find('.button-text').text(button_text_main);
                    updateProcessButtonState();
                }
            },
            error: function(insert_err) {
                frappe.show_alert({ message: 'فشل الاتصال بالخادم لتسجيل الدخول.', indicator: 'red' }, 7);
                console.error("Server call error for creating Bus Gate Control (insert):", insert_err);
                // إعادة تمكين الزر إذا فشل استدعاء الإنشاء
                $processButton.prop('disabled', false).removeClass('processing');
                $processButton.find('.spinner-border').addClass('d-none');
                $processButton.find('.button-text').text(button_text_main);
                updateProcessButtonState();
            }
            // لا حاجة لـ always هنا إذا كان الإنشاء هو الخطوة الأخيرة قبل الإرسال
            // أو إذا كان always الخاص بالإرسال سيتعامل مع كل شيء
        });
    });

    function resetEntryPage() {
        selectedItem = null;
        // selectedCustomer = null; // لا تمسح العميل إذا كنت تريد أن يبقى محدداً لعملية تالية
        // customer_field.set_value(""); // لا تمسح حقل العميل تلقائياً

        if (customer_field && typeof customer_field.set_value === 'function') {
             // إذا كنت تريد مسح العميل بعد كل عملية ناجحة، أزل التعليق:
             // customer_field.set_value("");
             // selectedCustomer = null;
             // $selectedCustomerInfo.text('').removeClass('visible');
        }
        // مسح تحديد الصنف
        $('.item-card-enhanced').removeClass('selected');
        selectedItem = null;


        updateProcessButtonState();
        if (typeof $itemsContainer.scrollTop === 'function') {
            $itemsContainer.scrollTop(0);
        }
    }
};