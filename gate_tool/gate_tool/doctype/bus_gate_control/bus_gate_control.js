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
    // --- زر الدخول ---
    const entry_wrapper = frm.get_field('entry').$wrapper;
    entry_wrapper.html(`
        <button class="btn btn-success btn-lg btn-block custom-action-btn" data-action="entry">
            <i class="fa fa-sign-in mr-2"></i> ${__('Entry')}
        </button>
    `);
    entry_wrapper.find('[data-action="entry"]').on('click', function() {
        handle_action(frm, 'entry');
    });

    // --- زر الخروج ---
    const exit_wrapper = frm.get_field('exit').$wrapper;
    exit_wrapper.html(`
        <button class="btn btn-danger btn-lg btn-block custom-action-btn" data-action="exit">
            <i class="fa fa-sign-out mr-2"></i> ${__('Exit')}
        </button>
    `);
    exit_wrapper.find('[data-action="exit"]').on('click', function() {
        handle_action(frm, 'exit');
    });

    // --- زر الإعفاء ---
    const exemption_wrapper = frm.get_field('exemption').$wrapper;
    exemption_wrapper.html(`
        <button class="btn btn-warning btn-lg btn-block custom-action-btn" data-action="exemption">
            <i class="fa fa-check-circle mr-2"></i> ${__('Exemption')}
        </button>
    `);
    exemption_wrapper.find('[data-action="exemption"]').on('click', function() {
        handle_action(frm, 'exemption');
    });

    // إضافة بعض الأنماط للأزرار إذا لزم الأمر
    if (!$('#custom-action-btn-styles').length) {
        $('head').append(`
            <style id="custom-action-btn-styles">
                .custom-action-btn {
                    font-weight: bold;
                    padding: 12px 15px;
                }
                .custom-action-btn i {
                    vertical-align: middle;
                }
            </style>
        `);
    }
}

// دالة لمعالجة أحداث الأزرار المخصصة
function handle_action(frm, action_type) {
    frappe.show_alert(`${__(action_type.charAt(0).toUpperCase() + action_type.slice(1))} action triggered.`);
    console.log(`Action button clicked: ${action_type}`);

    // المنطق الخاص بكل زر
    if (action_type === 'entry') {
        // frm.set_value('status', 'Entered');
        // frm.save();
        frappe.msgprint(`Perform Entry Action for document: ${frm.doc.name}`);
        // frm.save('Submit'); 
    } else if (action_type === 'exit') {
        // frm.set_value('status', 'Exited');
        // frm.save();
        frappe.msgprint(`Perform Exit Action for document: ${frm.doc.name}`);
    } else if (action_type === 'exemption') {
        // تبديل حالة حقل الإعفاء والتركيز على السبب إذا تم تفعيله
        let current_exempt_status = frm.doc.exempt;
        frm.set_value('exempt', current_exempt_status ? 0 : 1);
        frm.refresh_field('exempt');

        if (!current_exempt_status) {
            frm.scroll_to_field('reason_for_exemption');
            frm.get_field('reason_for_exemption').focus();
            frappe.msgprint(__("Please enter the reason for exemption."));
        }
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