import frappe

@frappe.whitelist(allow_guest=True)
def create_exit_invoice(customer, item_code, item_price):
    try:
        if not (customer and item_code):
            frappe.throw("Customer and Item are required.")

        invoice = frappe.new_doc("Sales Invoice")
        invoice.customer = customer
        invoice.is_pos = 1
        invoice.include_payment = 1
        invoice.set_posting_time = 1
        invoice.update_stock = 0
        invoice.pos_profile = "السامر1"  # اسم POS Profile

        invoice.append("items", {
            "item_code": item_code,
            "qty": 1,
            "rate": item_price,
            "price_list_rate": item_price,
        })

        invoice.append("payments", {
            "mode_of_payment": "بطاقة ائتمان",
            "amount": item_price,
        })

        invoice.insert(ignore_permissions=True)
        invoice.submit()

        return {"invoice_name": invoice.name}
    except Exception as e:
        frappe.log_error(f"Error creating exit invoice: {str(e)}")
        frappe.throw(f"حدث خطأ أثناء إنشاء الفاتورة: {str(e)}")

@frappe.whitelist(allow_guest=True)
def get_price(customer, item_code):
    price_list = frappe.db.get_value("Customer Group",
        frappe.db.get_value("Customer", customer, "customer_group"),
        "default_price_list"
    )

    if not price_list:
        return {"price": 0}

    item_price = frappe.db.get_value(
        "Item Price",
        {
            "price_list": price_list,
            "item_code": item_code
        },
        "price_list_rate"
    )

    return {"price": item_price or 0}
