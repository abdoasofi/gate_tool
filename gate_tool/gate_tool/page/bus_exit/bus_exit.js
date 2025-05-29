frappe.pages['bus-exit'].on_page_load = function(wrapper) {
    let page = frappe.ui.make_app_page({
        parent: wrapper,
        title: '🚌 تسجيل خروج الباص',
        single_column: true
    });

    wrapper = $(wrapper).find('.layout-main-section');
    wrapper.empty();

    let customerSelect = $(`<select id="customer-select" class="form-control mb-3" style="width: 300px; float: right;">
        <option value="">-- اختر السيارة (العميل) --</option>
    </select>`);
    wrapper.append(customerSelect);
    wrapper.append('<div style="clear:both;"></div>');

    let itemsContainer = $('<div id="items-container" class="row"></div>');
    wrapper.append(itemsContainer);

    let selectedItem = null;
    let selectedCustomer = null;
    let selectedItemPrice = 0;

    let priceLabel = $('<h4 id="price-label" style="margin-top: 20px; text-align: center;"></h4>');
    wrapper.append(priceLabel);

    let printButton = $('<button id="print-exit" class="btn btn-success" style="margin-top: 20px; display: block; margin-right:auto; margin-left:auto;">🚀 خروج وطباعة الإيصال</button>');
    wrapper.append(printButton);

    frappe.call({
        method: 'frappe.client.get_list',
        args: {
            doctype: 'Customer',
            fields: ['name'],
            limit_page_length: 1000
        },
        callback: function(r) {
            r.message.forEach(customer => {
                customerSelect.append(`<option value="${customer.name}">${customer.name}</option>`);
            });
        }
    });

    frappe.call({
        method: 'frappe.client.get_list',
        args: {
            doctype: 'Item',
            fields: ['name', 'item_name', 'image'],
			filters: {
				'item_group': 'Bus Gate Control'
			}
        },
        callback: function(r) {
            r.message.forEach(item => {
                let card = $(`<div class="col-md-2" style="margin: 10px;">
                    <div class="card item-card" data-item="${item.name}" style="cursor: pointer;">
                        <img src="${item.image || ''}" class="card-img-top" style="height: 100px; object-fit: cover;">
                        <div class="card-body">
                            <h5 class="card-title text-center">${item.item_name}</h5>
                        </div>
                    </div>
                </div>`);
                itemsContainer.append(card);
            });

            $('.item-card').click(function() {
                $('.item-card').css('border', 'none');
                $(this).css('border', '2px solid green');
                selectedItem = $(this).data('item');
                selectedCustomer = $('#customer-select').val();

                if (selectedItem && selectedCustomer) {
                    frappe.call({
                        method: 'gate_tool.gate_tool.page.bus_exit.bus_exit.get_price',
                        args: {
                            customer: selectedCustomer,
                            item_code: selectedItem
                        },
                        callback: function(r) {
                            selectedItemPrice = r.message.price || 0;
                            $('#price-label').html(`السعر: <span style="color: green;">${selectedItemPrice} جنيه</span>`);
                        }
                    });
                }
            });
        }
    });

    $('#customer-select').change(function() {
        selectedCustomer = $(this).val();
    });

    $('#print-exit').click(function() {
        if (!selectedCustomer || !selectedItem) {
            frappe.msgprint('يجب اختيار السيارة والصنف أولاً!');
            return;
        }

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

                    // أولاً نجلب مستند الفاتورة
                    frappe.call({
                        method: "frappe.client.get",
                        args: {
                            doctype: "Sales Invoice",
                            name: invoiceName
                        },
                        callback: function(res) {
                            if (res.message) {
                                frappe.call({
                                    method: "frappe.www.printview.get_html_and_style",
                                    args: {
                                        doc: res.message,
                                        format: "Bus Exit Receipt",
                                        no_letterhead: 1
                                    },
                                    callback: function(print_res) {
                                        if (print_res.message) {
                                            const printWindow = window.open('', '_blank');
                                            printWindow.document.write(print_res.message.html || '');
                                            printWindow.document.close();
                                            printWindow.focus();
                                            printWindow.print();

                                            setTimeout(() => {
                                                printWindow.close();
                                                location.reload();
                                            }, 3000);
                                        }
                                    }
                                });
                            }
                        }
                    });
                }
            }
        });
    });
};
