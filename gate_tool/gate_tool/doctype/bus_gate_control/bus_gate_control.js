// Copyright (c) 2025, Asofi and contributors
// For license information, please see license.txt

frappe.ui.form.on("Bus Gate control", {
	refresh(frm) {
        load_items(frm);

	},
    
});

//----------------------------------------------------------------------------------
// سلايدر الأصناف
//----------------------------------------------------------------------------------
function load_items(frm) {

    frappe.call({
        doc: frm.doc,
        method: "get_items",
        callback: function(response) {
            const items = response.message;
            const container = frm.get_field('items').$wrapper;

            // إعداد بنية HTML للسلايدر
            container.html(`
                <div class="swiper-container">
                    <div class="swiper-wrapper" id="item-container"></div>
                    <div class="swiper-button-next"></div>
                    <div class="swiper-button-prev"></div>
                    <div class="swiper-pagination"></div>
                </div>
            `);

            const itemContainer = container.find('#item-container');

            if (items && items.length) {
                items.forEach(function(item) {
                    const slide = `
                    <div class="swiper-slide">
                        <div class="card">
                            <img src="${item.image || '/assets/your_app/images/default.png'}" class="card-img-top fixed-image select_item_image" data-item_code="${item.name}" alt="${item.item_name}" style="width: 100%; object-fit: contain; cursor: pointer;">
                            <div class="card-body">
                                <h5 class="card-title">${item.item_name}</h5>

                            </div>
                        </div>
                    </div>
                `;
                    itemContainer.append(slide);
                });

                // تهيئة سلايدر العناصر
                initialize_item_slider(frm ,container);
            } else {
                itemContainer.html("<p>لا توجد عناصر مرتبطة بمجموعة الأصناف المختارة.</p>");
            }
        },
        error: function(error) {
            console.error("Error loading items: ", error);
            frm.get_field('items').$wrapper.html("<p>حدث خطأ أثناء جلب العناصر.</p>");
        }
    });
}
// تهيئة سلايدر العناصر
function initialize_item_slider(frm, container) {
    const swiperContainer = container.find('.swiper-container')[0];

    const swiper = new Swiper(swiperContainer, {
        slidesPerView: 1,
        spaceBetween: 5,
        loop: false,
        pagination: {
            el: container.find('.swiper-pagination')[0],
            clickable: true,
        },
        navigation: {
            nextEl: container.find('.swiper-button-next')[0],
            prevEl: container.find('.swiper-button-prev')[0],
        },
		breakpoints: {
            320: {slidesPerView: 1,},
            450: {slidesPerView: 2,},
            480: {slidesPerView: 3,},
            640: {slidesPerView: 4,},
            992: {slidesPerView: 5,},
            1300: {slidesPerView: 6,},
            1600: {slidesPerView: 7,}            
        }
    });

    container.find('.select_item_image').on('click', (function(current_frm) { // Create a closure
        return function() {
            const itemCode = $(this).data('item_code');

            if (itemCode) {
                add_item_to_table(current_frm, itemCode); // Use the captured 'current_frm'
            }
        };
    })(frm));

    container.find('.select_item').remove();
}
