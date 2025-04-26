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
		يتم استدعاؤها للحصول على الأصناف لمجموعة "Bus Gate Control".
		"""
		items_list = []
		try:
			items = frappe.get_all(
				'Item',
				fields=['name', 'item_name', 'image'],
				filters={"item_group": "Bus Gate Control", "disabled": 0}
			)

			for item in items:
				if item.image:
					if not item.image.startswith(('/files/', 'http://', 'https://')):
						item.image = f"/files/{item.image.lstrip('/')}"
				else:
					item.image = '/assets/frappe/images/fallback-image.png'
				items_list.append(item)
			return items_list

		except Exception as e:
			frappe.log_error(f"Error in get_items: {e}", _("Bus Gate Control Error"))
			return []