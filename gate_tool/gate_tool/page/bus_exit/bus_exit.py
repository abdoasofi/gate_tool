# bus_exit.py
import frappe
from frappe.utils import now_datetime, today, nowtime # تأكد من استيراد today و nowtime إذا كنت ستستخدمهما

@frappe.whitelist(allow_guest=True) # اضبط allow_guest حسب الحاجة الأمنية
def create_exit_invoice(customer, item_code, item_price):
    try:
        if not customer:
            frappe.throw("العميل مطلوب لإنشاء الفاتورة.")
        if not item_code:
            # إذا كان السعر يمكن أن يكون صفرًا، فلا تجعل الصنف يعتمد على السعر
            frappe.throw("الصنف مطلوب لإنشاء الفاتورة.")

        # 1. إنشاء مستند Bus Gate control من نوع خروج (للفاتورة العادية)
        bgc_doc = frappe.new_doc("Bus Gate control")
        bgc_doc.customer = customer
        bgc_doc.item = item_code
        bgc_doc.price = item_price if item_price is not None else 0 # تأكد من وجود قيمة للسعر
        bgc_doc.status = "Exited"
        # bgc_doc.date_and_taime = now_datetime() # عادة يتم تعيينه تلقائيًا
        bgc_doc.exempt = 0
        bgc_doc.insert(ignore_permissions=True)
        bgc_doc.submit()

        # 2. إنشاء فاتورة Sales Invoice
        invoice = frappe.new_doc("Sales Invoice")
        invoice.customer = customer
        invoice.is_pos = 1
        invoice.update_stock = 0
        
        invoice.set_posting_time = 1
        invoice.posting_date = today() # استخدام frappe.utils.today()
        # invoice.posting_time = nowtime() # استخدام frappe.utils.nowtime() إذا لزم الأمر

        # تحديد POS Profile
        # يمكنك محاولة جلبه ديناميكيًا أو استخدام قيمة ثابتة تم التحقق منها
        # pos_profile_user = frappe.db.get_value("POS Profile User", {"parent": frappe.session.user, "company": frappe.get_doc("Global Defaults").default_company}, "pos_profile")
        # invoice.pos_profile = pos_profile_user or "السامر1" # اسم POS Profile الصحيح لديك
        invoice.pos_profile = "السامر1" # تأكد من أن هذا الـ POS Profile موجود وصحيح

        invoice.append("items", {
            "item_code": item_code,
            "qty": 1,
            "rate": item_price if item_price is not None else 0,
            "price_list_rate": item_price if item_price is not None else 0,
        })

        # المدفوعات
        # تأكد أن item_price هو رقم قبل المقارنة
        numeric_item_price = float(item_price) if item_price is not None else 0.0

        if numeric_item_price > 0:
            # تحديد شركة الفاتورة (مهم لجلب حساب الدفع الصحيح)
            # invoice.company = frappe.get_doc("POS Profile", invoice.pos_profile).company or frappe.defaults.get_user_default("company")
            if not invoice.company: # إذا لم يتم تعيينها من POS Profile
                invoice.company = frappe.get_cached_value('Global Defaults', None, 'default_company')

            default_mop = frappe.get_cached_value('POS Profile', invoice.pos_profile, 'default_mode_of_payment') or "بطاقة ائتمان"
            
            default_account = frappe.get_cached_value('Mode of Payment Account', 
                                                     {'parent': default_mop, "company": invoice.company, 'parenttype': 'Mode of Payment'}, 
                                                     'default_account')
            if not default_account:
                 frappe.throw(f"لم يتم تعيين حساب افتراضي لطريقة الدفع '{default_mop}' في شركة '{invoice.company}'.")


            invoice.append("payments", {
                "mode_of_payment": default_mop,
                "amount": numeric_item_price,
                "account": default_account
            })
        
        invoice.insert(ignore_permissions=True)
        invoice.submit()

        return {"invoice_name": invoice.name, "bus_gate_control_docname": bgc_doc.name}

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Error creating exit invoice for {customer}, item {item_code}")
        frappe.throw(f"حدث خطأ أثناء إنشاء الفاتورة: {str(e)}")


@frappe.whitelist(allow_guest=True)
def process_bus_exemption(customer, reason_for_exemption, item_code=None):
    try:
        if not customer:
            frappe.throw("العميل مطلوب.")
        if not reason_for_exemption:
            frappe.throw("سبب الإعفاء مطلوب.")
        # إذا كان الصنف إجباريًا حتى في الإعفاء، قم بإضافة التحقق هنا
        # if not item_code:
        #     frappe.throw("الصنف مطلوب حتى في حالة الإعفاء.")


        bgc_doc = frappe.new_doc("Bus Gate control")
        bgc_doc.customer = customer
        if item_code: # يتم تمرير الصنف من JS إذا تم اختياره
            bgc_doc.item = item_code
        # bgc_doc.date_and_taime = now_datetime() # يتم تعيينه تلقائيًا
        bgc_doc.status = "Exemption"
        bgc_doc.exempt = 1
        bgc_doc.reason_for_exemption = reason_for_exemption
        bgc_doc.price = 0

        bgc_doc.insert(ignore_permissions=True)
        bgc_doc.submit()

        return {"bus_gate_control_docname": bgc_doc.name, "status": "success"}

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Error processing bus exemption for customer {customer}")
        frappe.throw(f"حدث خطأ أثناء معالجة الإعفاء: {str(e)}")


@frappe.whitelist(allow_guest=True)
def get_price(customer, item_code):
    if not customer or not item_code:
        return {"price": 0, "error": "العميل والصنف مطلوبان."}

    price_list = None
    customer_group = frappe.db.get_value("Customer", customer, "customer_group")
    if customer_group:
        price_list = frappe.db.get_value("Customer Group", customer_group, "default_price_list")

    if not price_list:
        selling_settings = frappe.get_cached_doc("Selling Settings")
        price_list = selling_settings.selling_price_list
    
    if not price_list:
        all_price_lists = frappe.get_all("Price List", filters={"selling": 1, "enabled": 1}, limit=1, order_by="is_default desc, name asc")
        if all_price_lists:
            price_list = all_price_lists[0].name
        else:
            return {"price": 0, "error": "لم يتم العثور على قائمة أسعار بيع نشطة."}

    item_price_data = frappe.db.get_value(
        "Item Price",
        {"price_list": price_list, "item_code": item_code, "selling": 1},
        ["price_list_rate", "currency"],
        as_dict=True
    )
    
    # تحديد عملة الشركة كعملة افتراضية إذا لم يتم تحديد عملة سعر الصنف
    default_company = frappe.defaults.get_user_default("company") or frappe.db.get_default("company")
    company_currency = frappe.get_cached_value('Company', default_company, 'default_currency') if default_company else "USD" # افتراضي إذا لم توجد شركة

    if item_price_data and item_price_data.price_list_rate is not None:
        return {"price": item_price_data.price_list_rate, "currency": item_price_data.currency or company_currency}
    else:
        item_standard_rate = frappe.db.get_value("Item", item_code, "standard_rate")
        if item_standard_rate is not None:
             return {"price": item_standard_rate, "currency": company_currency }
        
        return {"price": 0, "error": f"لم يتم العثور على سعر للصنف '{item_code}'."}