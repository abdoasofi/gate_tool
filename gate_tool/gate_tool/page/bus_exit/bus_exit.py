# bus_exit.py
import frappe
from frappe.utils import now_datetime, today, nowtime

# دالة مساعدة لجلب إعدادات Gate Tool
def get_gate_tool_settings():
    # بما أنه Doctype من نوع Single، يمكننا جلبه مباشرة
    # استخدام try-except للتعامل مع حالة عدم وجود المستند أو حقول معينة
    try:
        settings = frappe.get_cached_doc("Gate Tool Settings") # استخدام النسخة المخبأة للأداء
        if not settings: # إذا لم يكن في الكاش، اجلبه من قاعدة البيانات
            settings = frappe.get_single("Gate Tool Settings")
        return settings
    except frappe.DoesNotExistError:
        frappe.throw("لم يتم العثور على إعدادات 'Gate Tool Settings'. يرجى إنشائها أولاً.")
    except Exception as e:
        frappe.log_error(message=str(e), title="Error fetching Gate Tool Settings")
        frappe.throw(f"خطأ في جلب إعدادات Gate Tool: {str(e)}")


@frappe.whitelist(allow_guest=True)
def create_exit_invoice(customer, item_code, item_price):
    settings = get_gate_tool_settings() # جلب الإعدادات

    try:
        if not customer:
            frappe.throw("العميل مطلوب لإنشاء الفاتورة.")
        if not item_code:
            frappe.throw("الصنف مطلوب لإنشاء الفاتورة.")

        # 1. إنشاء مستند Bus Gate control
        bgc_doc = frappe.new_doc("Bus Gate control")
        bgc_doc.customer = customer
        bgc_doc.item = item_code
        bgc_doc.price = item_price if item_price is not None else 0
        bgc_doc.status = "Exited"
        bgc_doc.exempt = 0
        bgc_doc.insert(ignore_permissions=True)
        bgc_doc.submit()

        # 2. إنشاء فاتورة Sales Invoice
        invoice = frappe.new_doc("Sales Invoice")
        invoice.customer = customer
        invoice.is_pos = 1
        invoice.update_stock = 0
        invoice.set_posting_time = 1
        invoice.posting_date = today()
        
        # استخدام POS Profile من الإعدادات
        invoice.pos_profile = settings.pos_profile or "السامر1" # قيمة احتياطية إذا لم يتم تعيينها
        if not settings.pos_profile:
            frappe.msgprint("تحذير: لم يتم تعيين POS Profile في Gate Tool Settings. يتم استخدام قيمة افتراضية.", indicator="orange", alert=True)


        invoice.append("items", {
            "item_code": item_code,
            "qty": 1,
            "rate": item_price if item_price is not None else 0,
            "price_list_rate": item_price if item_price is not None else 0,
        })

        numeric_item_price = float(item_price) if item_price is not None else 0.0
        if numeric_item_price > 0:
            if not invoice.company:
                invoice.company = frappe.get_cached_value('Global Defaults', None, 'default_company')

            # استخدام طريقة الدفع الافتراضية من الإعدادات
            default_mop = settings.default_mode_of_payment or \
                          frappe.get_cached_value('POS Profile', invoice.pos_profile, 'default_mode_of_payment') or \
                          "Cash" # قيمة احتياطية متعددة المستويات
            if not settings.default_mode_of_payment:
                 frappe.msgprint("تحذير: لم يتم تعيين طريقة دفع افتراضية في Gate Tool Settings. يتم استخدام قيمة من POS Profile أو 'Cash'.", indicator="orange", alert=True)


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
    # settings = get_gate_tool_settings() # لا نحتاج لإعدادات خاصة هنا، فقط لإنشاء المستند
    try:
        # ... (نفس منطق process_bus_exemption السابق) ...
        if not customer:
            frappe.throw("العميل مطلوب.")
        if not reason_for_exemption:
            frappe.throw("سبب الإعفاء مطلوب.")
        
        bgc_doc = frappe.new_doc("Bus Gate control")
        bgc_doc.customer = customer
        if item_code:
            bgc_doc.item = item_code
        bgc_doc.status = "Exemption"
        bgc_doc.exempt = 1
        bgc_doc.reason_for_exemption = reason_for_exemption
        bgc_doc.price = 0
        bgc_doc.insert(ignore_permissions=True)
        bgc_doc.submit()
        return {"bus_gate_control_docname": bgc_doc.name, "status": "success"}

    except Exception as e:
        # ... (معالجة الخطأ كما كانت) ...
        frappe.log_error(frappe.get_traceback(), f"Error processing bus exemption for customer {customer}")
        frappe.throw(f"حدث خطأ أثناء معالجة الإعفاء: {str(e)}")


@frappe.whitelist(allow_guest=True)
def get_price(customer, item_code):
    # settings = get_gate_tool_settings() # لا نحتاج لإعدادات خاصة هنا بشكل مباشر
    # ... (نفس منطق get_price السابق) ...
    # ... (يمكنك تعديله إذا كانت قائمة الأسعار الافتراضية ستأتي من الإعدادات بدلاً من Customer Group أو Selling Settings)
    # ... لكن حاليًا، منطق get_price يبدو جيدًا كما هو ويعتمد على التسلسل الهرمي القياسي.
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
    
    default_company = frappe.defaults.get_user_default("company") or frappe.db.get_default("company")
    company_currency = frappe.get_cached_value('Company', default_company, 'default_currency') if default_company else "USD"

    if item_price_data and item_price_data.price_list_rate is not None:
        return {"price": item_price_data.price_list_rate, "currency": item_price_data.currency or company_currency}
    else:
        item_standard_rate = frappe.db.get_value("Item", item_code, "standard_rate")
        if item_standard_rate is not None:
             return {"price": item_standard_rate, "currency": company_currency }
        
        return {"price": 0, "error": f"لم يتم العثور على سعر للصنف '{item_code}'."}