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
		يتم استدعاؤها للحصول على الأصناف مجموعة .
		"""

		try:
			items = frappe.get_all('Item', fields=['name', 'item_name','image'], filters={"item_group": "Bus Gate Control"})
			for i in items:
				if i.image:
					i.image = f"{frappe.utils.get_url()}/{i.image}"
				return items
		except Exception as e:
			return []