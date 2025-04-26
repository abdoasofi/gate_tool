# Copyright (c) 2025, Asofi and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

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