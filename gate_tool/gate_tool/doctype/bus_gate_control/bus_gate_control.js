// ... (الكود السابق: refresh, load_items, initialize_item_slider, fetch_item_price, fetch_standard_rate) ...
// Copyright (c) 2025, Asofi and contributors
// For license information, please see license.txt

frappe.ui.form.on("Bus Gate control", {
    refresh(frm) {
        // استدعاء تحميل الأصناف عند تحديث الفورم
        load_items(frm);

        // تصميم وإضافة الأزرار المخصصة
        setup_custom_buttons(frm);

        // يمكنك إضافة أي منطق آخر لـ refresh هنا
    },

    // يمكنك إضافة معالجات أحداث أخرى هنا إذا لزم الأمر
    // مثال: عند تغيير العميل، قد ترغب في إعادة تحميل الأصناف إذا كانت تعتمد عليه
    // customer(frm) {
    //     load_items(frm);
    // }
});

//----------------------------------------------------------------------------------
// تحميل وعرض سلايدر الأصناف
//----------------------------------------------------------------------------------
function load_items(frm) {
    // إظهار مؤشر تحميل مؤقت
    const items_wrapper = frm.get_field('items').$wrapper;
    items_wrapper.html(`<div class="text-center text-muted p-4">${__("Loading Items...")}</div>`);

    frappe.call({
        doc: frm.doc,
        method: "get_items",
        callback: function(response) {
            const items = response.message;
            const container = frm.get_field('items').$wrapper;

            if (!items || !items.length) {
                container.html(`<div class="text-center text-muted p-4">${__("No items found.")}</div>`);
                return;
            }

            const items_per_slide = 10;
            let slider_html = `
                <style>
                    /* --- CSS لتخطيط الشبكة 5x2 داخل الشريحة --- */
                    .item-slider-container .swiper-slide {
                        display: grid; /* استخدام CSS Grid */
                        grid-template-columns: repeat(5, 1fr); /* 5 أعمدة متساوية العرض */
                        gap: 10px; /* المسافة بين العناصر (أفقياً وعمودياً) */
                        padding: 15px 10px; /* هوامش داخلية للشريحة (أعلى/أسفل , يمين/يسار) */
                        align-items: start; /* محاذاة العناصر لبداية صف الشبكة (لمنع التمدد غير المتساوي) */
                        min-height: 220px; /* ارتفاع أدنى للشريحة لاستيعاب صفين بشكل أفضل (يمكن تعديله) */
                    }
                    /* --- تنسيق بطاقة العنصر لتناسب الشبكة --- */
                    .item-slider-container .item-card {
                        border: 1px solid #e0e0e0; /* تغيير لون الحدود قليلاً */
                        border-radius: 6px; /* زيادة استدارة الزوايا */
                        text-align: center;
                        padding: 8px; /* تعديل الحشو الداخلي */
                        background-color: #fff;
                        cursor: pointer;
                        transition: box-shadow 0.2s ease-in-out, transform 0.2s ease;
                        display: flex; /* استخدام flex لتنظيم المحتوى الداخلي للبطاقة (الصورة والنص) */
                        flex-direction: column; /* ترتيب المحتوى عمودياً */
                        align-items: center; /* توسيط المحتوى أفقياً */
                        justify-content: flex-start; /* محاذاة المحتوى للأعلى */
                        overflow: hidden; /* لإخفاء أي تجاوز */
                    }
                    .item-slider-container .item-card:hover {
                        box-shadow: 0 6px 12px rgba(0,0,0,0.15);
                        transform: translateY(-2px); /* تأثير رفع طفيف عند المرور */
                    }
                    .item-slider-container .item-card img {
                        max-width: 100%;
                        height: 65px; /* تعديل ارتفاع الصورة قليلاً */
                        object-fit: contain;
                        margin-bottom: 8px; /* زيادة المسافة تحت الصورة */
                    }
                    .item-slider-container .item-card .item-name {
                        font-size: 0.8rem; /* تعديل حجم الخط */
                        font-weight: 500; /* تعديل وزن الخط */
                        color: #333;
                        line-height: 1.3; /* تحسين تباعد الأسطر */
                        /* السماح بـ سطرين كحد أقصى للنص */
                        display: -webkit-box;
                        -webkit-line-clamp: 2;
                        -webkit-box-orient: vertical;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        min-height: 2.6em; /* حجز مساحة لسطرين تقريباً */
                    }
                    .item-slider-container .swiper-button-next,
                    .item-slider-container .swiper-button-prev {
                        color: #007bff; /* لون أزرار التنقل */
                        transform: scale(0.8); /* تصغير حجم الأزرار قليلاً */
                    }
                    .item-slider-container .swiper-pagination-bullet-active {
                        background: #007bff; /* لون نقطة الترقيم النشطة */
                    }
                    .item-slider-container .swiper-container {
                        padding-bottom: 30px; /* إضافة مساحة سفلية لنقاط الترقيم */
                    }
                </style>
                <div class="swiper-container item-slider-container">
                    <div class="swiper-wrapper" id="item-container">
                    </div>
                    <!-- أزرار التنقل -->
                    <div class="swiper-button-next"></div>
                    <div class="swiper-button-prev"></div>
                    <!-- الترقيم -->
                    <div class="swiper-pagination"></div>
                </div>
            `;
            container.html(slider_html);
            const itemContainer = container.find('#item-container');

            // تقسيم الأصناف إلى مجموعات (شرائح) 
            for (let i = 0; i < items.length; i += items_per_slide) {
                const chunk = items.slice(i, i + items_per_slide);
                let slide_content = '';
                chunk.forEach(function(item) {
                    const imageUrl = item.image || '/assets/frappe/images/fallback-image.png';
                    slide_content += `
                        <div class="item-card" data-item_code="${item.name}" title="${item.item_name || item.name}">
                            <img src="${imageUrl}" alt="${item.item_name || item.name}">
                            <div class="item-name">${item.item_name || item.name}</div>
                        </div>
                    `;
                });
                itemContainer.append(`<div class="swiper-slide">${slide_content}</div>`);
            }

            // تهيئة سلايدر العناصر بعد إضافة كل الشرائح 
            initialize_item_slider(frm, container);

        },
        error: function(error) {
            console.error("Error loading items: ", error);
            frm.get_field('items').$wrapper.html(`<div class="text-center text-danger p-4">${__("Error loading items.")}</div>`);
        }
    });
}

/**
 * تهيئة سلايدر العناصر (Swiper) وإضافة معالج النقر على العناصر.
 * تم تكوينه لعرض شريحة واحدة فقط في كل مرة.
 * @param {object} frm - كائن الفورم الحالي.
 * @param {jQuery} container - عنصر jQuery الذي يحتوي على بنية السلايدر.
 */
function initialize_item_slider(frm, container) {
    const swiperContainer = container.find('.swiper-container')[0];

    // التأكد من تحميل مكتبة Swiper
    if (typeof Swiper === 'undefined') {
        frappe.msgprint(__("Swiper library is not loaded. Cannot initialize item slider."));
        console.error("Swiper library not found.");
        return;
    }

    try {
        const swiper = new Swiper(swiperContainer, {
            // ---   الإعداد الرئيسي لعرض شريحة واحدة فقط ---
            slidesPerView: 1,

            spaceBetween: 15, // المسافة بين الشرائح (غير مرئية عادةً مع slidesPerView: 1)
            loop: false,      // عدم تكرار الشرائح عند الوصول للنهاية/البداية
            watchOverflow: true, // تعطيل التنقل إذا كانت جميع الشرائح مرئية (مفيد إذا كان هناك شريحة واحدة فقط)

            pagination: {
                el: container.find('.swiper-pagination')[0], // عنصر الترقيم
                clickable: true,                            // جعل الترقيم قابلاً للنقر
            },
            navigation: {
                nextEl: container.find('.swiper-button-next')[0], // زر التالي
                prevEl: container.find('.swiper-button-prev')[0], // زر السابق
            },
        });
    } catch (e) {
        console.error("Failed to initialize Swiper:", e);
        frappe.show_alert({ message: __("Failed to initialize item slider."), indicator: "red" });
        return;
    }


    // معالج النقر على بطاقة الصنف (الكود كما هو من التعديل السابق)
    container.find('.item-card').on('click', function() {
        const itemCode = $(this).data('item_code');

        if (!itemCode) {
            console.error("Item code not found on clicked element.");
            frappe.show_alert({ message: __("Could not identify the selected item."), indicator: "warning" });
            return;
        }

        // التحقق من اختيار العميل
        if (!frm.doc.customer) {
            frappe.msgprint({
                title: __('Customer Required'),
                message: __('Please select a customer before selecting an item.'),
                indicator: 'orange'
            });
            frm.scroll_to_field('customer');
            return;
        }

        // تعيين قيمة حقل الصنف
        frm.set_value('item', itemCode);

        frappe.show_alert({ message: __("Fetching price..."), indicator: "orange" }, 2);

        // استدعاء دالة جلب السعر والحفظ
        fetch_item_price(frm, itemCode)
            .then(() => {
                console.log(`Price fetched/set for item ${itemCode}. Current price: ${frm.doc.price}`);
                frappe.show_alert({ message: __("Saving..."), indicator: "blue" }, 1);
                return frm.save();
            })
            .then(() => {
                frappe.show_alert({ message: __("Item selected and document saved."), indicator: "green" }, 3);
                console.log(`Document saved successfully after selecting item ${itemCode}.`);
            })
            .catch((err) => {
                console.error("Error during item selection or save process:", err);
            });

    });

}

//----------------------------------------------------------------------------------
// تصميم وإضافة الأزرار المخصصة (الدخول، الخروج، الإعفاء)
//----------------------------------------------------------------------------------
function setup_custom_buttons(frm) {
    // إخفاء الأزرار إذا كان المستند معتمداً (docstatus > 0)
    let buttons_visible = frm.doc.docstatus === 0;

    // --- زر الدخول ---
    const entry_wrapper = frm.get_field('entry').$wrapper;
    if (buttons_visible) {
        entry_wrapper.html(`
            <button class="btn btn-success btn-lg btn-block custom-action-btn" data-action="entry" title="${__('Submit this entry and open a new form')}">
                <i class="fa fa-sign-in mr-2"></i> ${__('Entry')}
            </button>
        `);
        entry_wrapper.find('[data-action="entry"]').on('click', function() {
            handle_action(frm, 'entry');
        });
    } else {
        entry_wrapper.empty(); // إزالة الزر إذا كان المستند معتمداً
    }


    // --- زر الخروج ---
    const exit_wrapper = frm.get_field('exit').$wrapper;
     if (buttons_visible) {
        exit_wrapper.html(`
            <button class="btn btn-danger btn-lg btn-block custom-action-btn" data-action="exit" title="${__('Submit, potentially create invoice, print receipt, and open new form')}">
                <i class="fa fa-sign-out mr-2"></i> ${__('Exit')}
            </button>
        `);
        exit_wrapper.find('[data-action="exit"]').on('click', function() {
            handle_action(frm, 'exit');
        });
    } else {
         exit_wrapper.empty();
     }

    // --- زر الإعفاء ---
    // (لا يزال يظهر حتى لو تم الاعتماد، لكن التفعيل/التعطيل يعتمد على حالة الحقل)
    const exemption_wrapper = frm.get_field('exemption').$wrapper;
    // تصميم زر الإعفاء يعتمد على حالة exempt الحالية
    let exempt_btn_class = frm.doc.exempt ? "btn-warning" : "btn-outline-warning"; // تغيير المظهر قليلاً
    let exempt_icon = frm.doc.exempt ? "fa-check-circle" : "fa-circle-o";
    exemption_wrapper.html(`
        <button class="btn ${exempt_btn_class} btn-lg btn-block custom-action-btn" data-action="exemption" title="${__('Toggle exemption status')}">
            <i class="fa ${exempt_icon} mr-2"></i> ${__('Exemption')}
        </button>
    `);
    exemption_wrapper.find('[data-action="exemption"]').on('click', function() {
        // لا نسمح بتغيير الإعفاء بعد الاعتماد
        if (frm.doc.docstatus !== 0) {
             frappe.show_alert({message: __("Cannot change exemption status after submission."), indicator: "warning"});
             return;
        }
        handle_action(frm, 'exemption');
    });


    // إعادة تطبيق الأنماط (نفس الكود السابق)
    if (!$('#custom-action-btn-styles').length) {
        $('head').append(`
            <style id="custom-action-btn-styles">
                .custom-action-btn {
                    font-weight: bold;
                    padding: 12px 15px;
                    transition: background-color 0.2s ease, border-color 0.2s ease; /* انتقال سلس */
                }
                .custom-action-btn i { vertical-align: middle; }
            </style>
        `);
    }
}


//----------------------------------------------------------------------------------
// دالة لمعالجة أحداث الأزرار المخصصة
//----------------------------------------------------------------------------------
function handle_action(frm, action_type) {
    console.log(`Action button clicked: ${action_type} for Doc: ${frm.doc.name}`);

    // --- معالجة زر الدخول ---
    if (action_type === 'entry') {
        frm.set_value('status', 'Entered');
        // التأكد من أن المستند ليس جديداً ولم يتم اعتماده
        if (frm.is_new()) {
            frappe.msgprint(__("Please save the document before submitting."));
            return;
        }
        if (frm.doc.docstatus !== 0) {
             frappe.msgprint(__("Document is already submitted."));
             return;
        }

        // التأكد من وجود البيانات الأساسية (يمكن إضافة المزيد حسب الحاجة)
        if (!frm.doc.customer || !frm.doc.item) {
             frappe.throw(__("Customer and Item must be selected before Entry."));
        }


        frappe.confirm(
            __('Are you sure you want to submit this entry?'),
            () => {
                // نعم، قم بالاعتماد وفتح مستند جديد
                // frappe.ui.toolbar.show_progress(__('Submitting...'), 30); // إظهار مؤشر التقدم
                frm.call({
                    method: "handle_entry", // استدعاء دالة Python
                    doc: frm.doc, // تمرير المستند الحالي للخادم
                    callback: function(r) {
                        // frappe.ui.toolbar.hide_progress(); // إخفاء مؤشر التقدم
                        if (r.message && r.message.status === 'success') {
                            // تم الاعتماد بنجاح
                            frappe.show_alert({ message: __('Entry submitted successfully!'), indicator: 'green' }, 5);
                            // فتح مستند جديد
                            frappe.new_doc('Bus Gate control', true); // true لفتح فوري
                        } else if (r.message && r.message.status === 'already_submitted') {
                            // كان معتمداً بالفعل (للأمان، على الرغم من التحقق المسبق)
                             frappe.new_doc('Bus Gate control', true);
                        }
                        // سيتم التعامل مع الأخطاء تلقائيًا بواسطة frappe.call
                    },
                    error: function() {
                         frappe.ui.toolbar.hide_progress();
                    }
                });
            },
            () => {
                // لا، لا تفعل شيئًا
                frappe.show_alert({ message: __('Submission cancelled.'), indicator: 'info' });
            }
        );

    }
    // --- معالجة زر الخروج ---
    else if (action_type === 'exit') {
        frm.set_value('status', 'Exited');
        if (frm.is_new()) {
            frappe.msgprint(__("Please save the document before processing exit."));
            return;
        }
         if (frm.doc.docstatus !== 0) {
             frappe.msgprint(__("Exit process cannot be run on an already submitted document this way."));
             return;
        }
         // التأكد من وجود البيانات الأساسية
        if (!frm.doc.customer || !frm.doc.item) {
             frappe.throw(__("Customer and Item must be selected before Exit."));
        }

        // التحقق من سبب الإعفاء إذا تم تحديده
        if (frm.doc.exempt && !frm.doc.reason_for_exemption) {
            frappe.msgprint({
                title: __('Validation Error'),
                indicator: 'red',
                message: __("Reason for exemption is required when 'Exempt' is checked.")
            });
            frm.scroll_to_field('reason_for_exemption');
            return; // إيقاف التنفيذ
        }

        frappe.confirm(
            __('Are you sure you want to process the exit? This will submit the document and may create an invoice.'),
            () => {
                // نعم، قم بالاعتماد، إنشاء فاتورة (إذا لزم الأمر)، الطباعة، وفتح مستند جديد
                // frappe.ui.toolbar.show_progress(__('Processing Exit...'), 30);
                frm.call({
                    method: "handle_exit", // استدعاء دالة Python
                    doc: frm.doc,
                    callback: function(r) {
                        // frappe.ui.toolbar.hide_progress();
                        if (r.message && r.message.status === 'success') {
                            // نجحت العملية الأساسية (الاعتماد وإنشاء الفاتورة إذا لزم الأمر)
                            let exit_message = __('Exit processed successfully!');
                            if (r.message.sales_invoice_link) {
                                exit_message += "<br>" + __("Sales Invoice created: {0}", [`<b>${r.message.sales_invoice_link}</b>`]);
                            }
                             frappe.show_alert({ message: exit_message, indicator: 'green' }, 7);

                             // *** الطباعة ***
                             // طباعة المستند الحالي (Bus Gate control)
                             frappe.show_alert({ message: __('Preparing receipt for printing...'), indicator: 'info' }, 3);
                             // استخدام مهلة قصيرة للتأكد من تحديث الواجهة قبل فتح مربع الطباعة
                             setTimeout(() => {
                                 try {
                                    // استخدام اسم المستند الذي تم إرجاعه من الخادم للتأكد من الطباعة الصحيحة
                                    // حتى لو حدث شيء أثناء الاستدعاء غير المتزامن
                                    frappe.open_print_dialog('Bus Gate control', r.message.submitted_doc_name || frm.doc.name);
                                 } catch(print_err) {
                                     console.error("Print dialog error:", print_err);
                                     frappe.msgprint(__("Could not open print dialog automatically. Please use the standard Print option."));
                                 }

                                 // *** فتح مستند جديد ***
                                 // بعد محاولة الطباعة (أو فشلها)، افتح مستنداً جديداً
                                 frappe.new_doc('Bus Gate control', true);

                             }, 500); // تأخير 500 مللي ثانية

                        }
                         // سيتم التعامل مع الأخطاء تلقائيًا بواسطة frappe.call
                    },
                    error: function() {
                         frappe.ui.toolbar.hide_progress();
                    }
                });
            },
            () => {
                 frappe.show_alert({ message: __('Exit process cancelled.'), indicator: 'info' });
            }
        );

    }
    // --- معالجة زر الإعفاء ---
    else if (action_type === 'exemption') {
        frm.set_value('status', 'Exemption');
         // لا يمكن التغيير بعد الاعتماد
        if (frm.doc.docstatus !== 0) {
             frappe.show_alert({message: __("Cannot change exemption status after submission."), indicator: "warning"});
             return;
        }

        // تبديل حالة حقل الإعفاء
        let current_exempt_status = frm.doc.exempt;
        frm.set_value('exempt', current_exempt_status ? 0 : 1); // تبديل القيمة (0 أو 1)
        frm.refresh_field('exempt'); // تحديث عرض الحقل Check

        // تحديث زر الإعفاء ليعكس الحالة الجديدة
        setup_custom_buttons(frm); // إعادة رسم الأزرار

        // إذا تم تفعيل الإعفاء، قم بالتركيز على حقل السبب وتذكير المستخدم
        if (!current_exempt_status) { // يعني أنه أصبح 1 الآن
            frm.scroll_to_field('reason_for_exemption');
            // استخدام مهلة قصيرة للتأكد من أن الحقل مرئي قبل التركيز عليه
            setTimeout(() => {
                 frm.get_field('reason_for_exemption').focus();
                 frappe.show_alert({ message: __("Exemption enabled. Please enter the reason."), indicator: "info" });
            }, 100);
        } else {
             frappe.show_alert({ message: __("Exemption disabled."), indicator: "info" });
             // اختياري: مسح حقل السبب عند إلغاء الإعفاء
             // frm.set_value('reason_for_exemption', '');
        }
        // لا نحفظ هنا، نترك المستخدم يحفظ أو يتم الحفظ عند الدخول/الخروج
    }
}

/**
 * دالة لجلب سعر الصنف بناءً على قائمة أسعار العميل أو السعر القياسي.
 * @param {object} frm 
 * @param {string} item_code 
 * @returns {Promise}
 */
function fetch_item_price(frm, item_code) {
    return new Promise((resolve, reject) => {
        // 1. الحصول على قائمة الأسعار من حقل الفورم (الذي يجب أن يتم تحديثه تلقائيًا)
        const customer_price_list = frm.doc.price_list;

        // 2. التحقق مما إذا كانت قائمة أسعار العميل موجودة
        if (customer_price_list) {
            console.log(`Attempting to fetch price for item ${item_code} from Price List: ${customer_price_list}`);
            frappe.call({
                method: 'frappe.client.get_value',
                args: {
                    doctype: 'Item Price',
                    filters: {
                        item_code: item_code,
                        price_list: customer_price_list
                    },
                    fieldname: ['price_list_rate']
                },
                callback: function(r) {
                    if (r.message && r.message.price_list_rate != undefined) {
                        console.log(`Price found in ${customer_price_list}: ${r.message.price_list_rate}`);
                        frm.set_value('price', r.message.price_list_rate);
                        frm.refresh_field('price');
                        resolve();
                    } else {
                        // 3. إذا لم يتم العثور على سعر في قائمة أسعار العميل، حاول السعر القياسي
                        console.warn(`Item ${item_code} not found in Price List ${customer_price_list}. Falling back to standard rate.`);
                        fetch_standard_rate(frm, item_code).then(resolve).catch(reject);
                    }
                },
                error: function(err) {
                    console.error(`Error fetching Item Price from ${customer_price_list}. Falling back to standard rate.`, err);
                    fetch_standard_rate(frm, item_code).then(resolve).catch(reject);
                }
            });
        } else {
            // 4. إذا لم تكن هناك قائمة أسعار محددة للعميل، حاول السعر القياسي مباشرة
            console.warn(`Customer Price List not set for customer ${frm.doc.customer || 'N/A'}. Falling back to standard rate for item ${item_code}.`);
            fetch_standard_rate(frm, item_code).then(resolve).catch(reject);
        }
    });
}

/**
 * دالة مساعدة لجلب وتعيين السعر القياسي للصنف.
 * @param {object} frm
 * @param {string} item_code
 * @returns {Promise}
 */
function fetch_standard_rate(frm, item_code) {
    return new Promise((resolve, reject) => {
        frappe.db.get_value('Item', item_code, 'standard_rate')
            .then(r => {
                let price = 0;
                if (r && r.standard_rate != undefined) {
                    price = r.standard_rate;
                    console.log(`Using standard rate for item ${item_code}: ${price}`);
                } else {
                    console.warn(`Standard rate not found for item ${item_code}. Setting price to 0.`);
                }
                frm.set_value('price', price);
                frm.refresh_field('price');
                resolve();
            })
            .catch(err => {
                console.error(`Error fetching standard rate for item ${item_code}:`, err);
                frm.set_value('price', 0);
                frm.refresh_field('price');
                reject(err);
            });
    });
}