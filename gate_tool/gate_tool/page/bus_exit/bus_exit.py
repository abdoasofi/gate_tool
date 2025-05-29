import frappe
from frappe.utils import now_datetime # Import now_datetime

@frappe.whitelist(allow_guest=True)
def create_exit_invoice(customer, item_code, item_price):
    try:
        if not (customer and item_code):
            frappe.throw("العميل والصنف مطلوبان.")

        # 1. إنشاء مستند Bus Gate control من نوع خروج
        # --------------------------------------------
        bgc_doc = frappe.new_doc("Bus Gate control")
        bgc_doc.customer = customer
        bgc_doc.item = item_code
        bgc_doc.price = item_price # يمكنك إضافة السعر هنا إذا أردت تخزينه في مستند التحكم أيضاً
        bgc_doc.status = "Exited" # تحديد الحالة كـ "خروج"
        # حقل date_and_taime سيتم تعيينه تلقائياً إلى "now" حسب تعريف Doctype
        # إذا لم يتم تعيينه تلقائياً بشكل صحيح، يمكنك تعيينه يدوياً:
        # bgc_doc.date_and_taime = now_datetime()

        bgc_doc.insert(ignore_permissions=True)
        bgc_doc.submit() # إرسال المستند لأنه is_submittable

        frappe.msgprint(f"تم إنشاء مستند التحكم بالبوابة بنجاح: {bgc_doc.name}", title="نجاح", indicator="green")

        # 2. إنشاء فاتورة Sales Invoice (المنطق الحالي)
        # -------------------------------------------
        invoice = frappe.new_doc("Sales Invoice")
        invoice.customer = customer
        invoice.is_pos = 1
        invoice.include_payment = 1
        invoice.set_posting_time = 1
        invoice.update_stock = 0 # عادةً في خدمات البوابات لا يتم تحديث المخزون للأصناف الخدمية
        invoice.pos_profile = "السامر1"  # تأكد من أن هذا الـ POS Profile موجود وصحيح

        invoice.append("items", {
            "item_code": item_code,
            "qty": 1,
            "rate": item_price,
            "price_list_rate": item_price, # تأكد أن قائمة الأسعار تستخدم هذا السعر
        })

        # تأكد من أن "Cash" أو طريقة الدفع المحددة معرفة في نظامك
        # وأن حسابها مرتبط بشكل صحيح في Mode of Payment
        invoice.append("payments", {
            "mode_of_payment": "بطاقة ائتمان",
            "account": frappe.db.get_value("Mode of Payment Account", {"parent": "Cash", "company": invoice.company}, "default_account"), # لجلب الحساب الافتراضي
            "amount": item_price,
        })

        invoice.insert(ignore_permissions=True)
        invoice.submit()

        return {"invoice_name": invoice.name, "bus_gate_control_docname": bgc_doc.name}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Error creating Bus Gate Control or Exit Invoice for customer {customer}, item {item_code}")
        # إرجاع رسالة خطأ أكثر تفصيلاً للمستخدم إذا أردت
        frappe.throw(f"حدث خطأ أثناء إنشاء مستند التحكم أو الفاتورة: {str(e)}")

@frappe.whitelist(allow_guest=True)
def get_price(customer, item_code):
    if not customer or not item_code:
        return {"price": 0, "error": "العميل والصنف مطلوبان."}

    customer_doc = frappe.get_doc("Customer", customer)
    price_list = customer_doc.default_price_list

    # إذا لم يكن للعميل قائمة أسعار افتراضية، استخدم قائمة أسعار البيع الافتراضية من إعدادات الشركة
    if not price_list:
        selling_settings = frappe.get_single("Selling Settings")
        price_list = selling_settings.selling_price_list
    
    if not price_list:
         # كحل أخير إذا لم تكن هناك قائمة أسعار بيع افتراضية في إعدادات البيع
        all_price_lists = frappe.get_all("Price List", filters={"selling": 1}, limit=1)
        if all_price_lists:
            price_list = all_price_lists[0].name
        else: # إذا لم توجد أي قائمة أسعار بيع على الإطلاق
            frappe.msgprint("لم يتم العثور على قائمة أسعار بيع مناسبة.", indicator="orange")
            return {"price": 0, "error": "لم يتم العثور على قائمة أسعار بيع."}


    item_price_data = frappe.db.get_value(
        "Item Price",
        {
            "price_list": price_list,
            "item_code": item_code
        },
        ["price_list_rate", "currency"], # احصل على العملة أيضًا
        as_dict=True
    )

    if item_price_data:
        return {"price": item_price_data.price_list_rate or 0, "currency": item_price_data.currency}
    else:
        # إذا لم يتم العثور على سعر في قائمة الأسعار المحددة، حاول البحث في سعر الصنف القياسي
        item_standard_rate = frappe.db.get_value("Item", item_code, "standard_rate")
        if item_standard_rate:
             return {"price": item_standard_rate or 0, "currency": frappe.get_doc("Company", frappe.defaults.get_global_default("company")).default_currency } # افترض عملة الشركة الافتراضية
        
        frappe.msgprint(f"لم يتم العثور على سعر للصنف '{item_code}' في قائمة الأسعار '{price_list}'.", indicator="orange")
        return {"price": 0, "error": f"لم يتم العثور على سعر للصنف '{item_code}' في قائمة الأسعار '{price_list}'."}