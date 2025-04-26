# Copyright (c) 2025, Asofi and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import nowdate, get_link_to_form

class BusGatecontrol(Document):
	"""
	نموذج التحكم في بوابة الحافلة.
	"""
	@frappe.whitelist()
	def get_items(self):
		"""
		يتم استدعاؤها للحصول على الأصناف بناءً على المجموعة المحددة في إعدادات Gate Tool Settings.
		"""
		items_list = []
		target_item_group = None

		try:
			# --- خطوة 1: جلب اسم مجموعة الأصناف من الإعدادات ---
			target_item_group = frappe.get_cached_value('Gate Tool Settings', 'Gate Tool Settings', 'item_group')

			# --- خطوة 2: التحقق من أن القيمة موجودة ---
			if not target_item_group:
				# الخيار 1: إلقاء خطأ لإعلام المستخدم بأن الإعدادات غير مكتملة (مفضل غالبًا)
				frappe.throw(
					_("Item Group is not configured in Gate Tool Settings. Please go to Gate Tool Settings and set the 'Item Group' field."),
					title=_("Configuration Required")
				)

			# --- خطوة 3: جلب الأصناف باستخدام مجموعة الأصناف الديناميكية ---
			items = frappe.get_all(
				'Item',
				fields=['name', 'item_name', 'image'],
				filters={
					"item_group": target_item_group,
					"disabled": 0
				}
			)

			# --- خطوة 4: معالجة الصور ---
			for item in items:
				if item.image:
					# التأكد من أن المسار النسبي يبدأ بشكل صحيح للعرض على الويب
					if not item.image.startswith(('/files/', 'http://', 'https://')):
						item.image = f"/files/{item.image.lstrip('/')}"
				else:
					# توفير صورة بديلة
					item.image = '/assets/frappe/images/fallback-image.png'
				items_list.append(item)

			return items_list

		except Exception as e:
			frappe.log_error(f"Error in get_items while fetching/processing items for group '{target_item_group}': {e}", _("Bus Gate Control Error"))
			if not isinstance(e, frappe.ValidationError):
				frappe.throw(_("An error occurred while fetching items. Please check the logs or contact support."))

			return []


	# # --- دالة Validate للتحقق من سبب الإعفاء ---
	# def validate(self):
	# 	if self.exempt and not self.reason_for_exemption:
	# 		frappe.throw(_("Reason for exemption is required when 'Exempt' is checked."))

	# --- دالة لمعالجة الدخول ---
	@frappe.whitelist()
	def handle_entry(self):
		"""
		يعتمد المستند الحالي. يتم استدعاؤها عند الضغط على زر الدخول.
		"""
		try:
			if self.docstatus == 0:
				self.submit()
				frappe.msgprint(
					_("Document {0} submitted successfully.").format(self.name),
					title=_("Success"),
					indicator="green"
				)
				return {"status": "success"}
			else:
				frappe.msgprint(_("Document already submitted."), indicator="blue")
				return {"status": "already_submitted"}

		except Exception as e:
			frappe.log_error(f"Error submitting Bus Gate control {self.name} on Entry: {e}")
			frappe.throw(_("Failed to submit the document. Error: {0}").format(str(e)))


	# --- دالة لمعالجة الخروج ---
	@frappe.whitelist()
	def handle_exit(self):
		"""
		يعتمد المستند، ينشئ فاتورة مبيعات إذا كان exempt=1، ويجهز للطباعة.
		"""
		submitted_doc_name = self.name
		sales_invoice_link = None

		try:
			# 1. اعتماد المستند الحالي إذا لم يكن معتمداً
			if self.docstatus == 0:
				self.submit()
				frappe.msgprint(
					_("Document {0} submitted successfully.").format(self.name),
					title=_("Success"),
					indicator="green"
				)
			else:
				# إذا كان معتمداً بالفعل، استمر لإنشاء الفاتورة إذا لزم الأمر
				frappe.msgprint(_("Document {0} was already submitted.").format(self.name), indicator="blue")


			# 2. التحقق وإنشاء فاتورة مبيعات إذا exempt == 1
			# ***** تنبيه: المنطق المطلوب هو إنشاء فاتورة إذا كان "معفى" *****
			# ***** هذا قد يكون غير تقليدي، تأكد من أن هذا هو المطلوب فعلاً *****
			# ***** إذا كان المطلوب هو العكس (إنشاء فاتورة إذا "غير معفى")، غيّر الشرط إلى: if not self.exempt: *****
			if self.exempt == 1:
				if not self.item or not self.customer or self.price is None:
					frappe.throw(_("Cannot create Sales Invoice. Customer, Item, and Price must be set."))

				frappe.msgprint(_("Exempt is checked. Creating Sales Invoice..."), indicator="orange")
				sales_invoice_doc = self._create_and_submit_sales_invoice()
				sales_invoice_link = get_link_to_form("Sales Invoice", sales_invoice_doc.name)
				frappe.msgprint(
					_("Sales Invoice {0} created and submitted successfully.").format(sales_invoice_link),
					title=_("Invoice Created"),
					indicator="green"
				)


			# 3. إرجاع الحالة للـ JavaScript (مع رابط الفاتورة إذا تم إنشاؤها)
			return {
				"status": "success",
				"submitted_doc_name": submitted_doc_name,
				"sales_invoice_link": sales_invoice_link
			}

		except Exception as e:
			frappe.log_error(f"Error processing Exit for Bus Gate control {submitted_doc_name}: {e}")
			frappe.throw(_("Failed to process Exit. Error: {0}").format(str(e)))


	# --- دالة مساعدة لإنشاء فاتورة المبيعات ---
	def _create_and_submit_sales_invoice(self):
		"""
		ينشئ ويرسل فاتورة مبيعات بناءً على بيانات مستند Bus Gate control الحالي.
		"""
		# قد تحتاج لتعديل الحسابات الافتراضية والشركة بناءً على إعداداتك
		company =  frappe.defaults.get_user_default("company")
		if not company:
			frappe.throw(_("Default Company not set for User {0} or in the document.").format(frappe.session.user))

		# يمكنك جعل هذه الحسابات قابلة للتكوين في الإعدادات إذا أردت
		# debit_to_account = frappe.get_cached_value('Company', company, 'default_receivable_account')
		# income_account = frappe.get_cached_value('Company', company, 'default_income_account')
		# # حاول الحصول على حساب الدخل من مجموعة الصنف أو الصنف نفسه كأولوية
		# item_income_account = frappe.db.get_value("Item", self.item, "income_account")
		# if item_income_account:
		# 	income_account = item_income_account
		# else:
		# 	item_group_income_account = frappe.db.get_value("Item Group", frappe.db.get_value("Item", self.item, "item_group"), "income_account")
		# 	if item_group_income_account:
		# 		income_account = item_group_income_account

		# if not debit_to_account:
		# 	frappe.throw(_("Default Receivable Account not set in Company: {0}").format(company))
		# if not income_account:
		# 	frappe.throw(_("Default Income Account not set in Company or Item/Item Group for Item: {0}").format(self.item))

		# إنشاء مستند فاتورة المبيعات
		si = frappe.new_doc("Sales Invoice")
		si.customer = self.customer
		si.company = company
		si.posting_date = nowdate()
		si.due_date = nowdate() # فاتورة مدفوعة، تاريخ الاستحقاق هو نفس تاريخ الإنشاء
		si.currency = frappe.get_cached_value('Company', company, 'default_currency')
		si.selling_price_list = self.price_list

		# إضافة الصنف
		si.append("items", {
			"item_code": self.item,
			"item_name": frappe.db.get_value("Item", self.item, "item_name"),
			"qty": 1,
			"rate": self.price,
			# "income_account": income_account,
			"cost_center": frappe.get_cached_value('Company', company, 'cost_center'),
			# قد تحتاج لإضافة "warehouse" إذا كان الصنف يتطلب ذلك وكان update_stock=1
		})

		# --- تعليم الفاتورة كمدفوعة (طرق مختلفة) ---
		# الطريقة 1: استخدام is_pos (يعتمد على إعدادات POS)
		si.is_pos = 1
		# قد تحتاج لتحديد Mode of Payment و حساب الدفع إذا كان is_pos يتطلب ذلك
		default_mop = frappe.db.get_value("Mode of Payment", {"type": "Cash"}, "name")
		default_cash_account = frappe.get_cached_value('Company', company, 'default_cash_account')
		if default_mop and si.is_pos:
			si.append("payments", {
				"mode_of_payment": default_mop,
				"account": default_cash_account,
				"amount": si.grand_total
			})


		# الطريقة 2: (أكثر تعقيدًا) إنشاء Payment Entry بعد إرسال الفاتورة

		# --- ---

		si.update_stock = 0 # نفترض أن هذه الخدمة لا تؤثر على المخزون
		si.set_posting_time = 1 # تسجيل وقت الإنشاء

		# حساب الضرائب والإجماليات
		si.run_method("set_missing_values")
		si.run_method("calculate_taxes_and_totals")


		# حفظ وإرسال الفاتورة
		try:
			si.insert(ignore_permissions=False)
			si.submit()
			return si
		except frappe.PermissionError:
			# إذا فشلت الصلاحيات، حاول مع تجاهل الصلاحيات (يتطلب صلاحيات مسؤول للنظام)
			frappe.log_warning(f"Permission error submitting Sales Invoice for {self.name}. Retrying with ignore_permissions=True.")
			si.insert(ignore_permissions=True)
			si.submit()
			return si
		except Exception as invoice_error:
			frappe.log_error(f"Error creating/submitting Sales Invoice for Bus Gate {self.name}: {invoice_error}")
			frappe.throw(_("Failed to create or submit Sales Invoice. Error: {0}").format(str(invoice_error)))

