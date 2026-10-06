import os
import re

FILES = [
    ("purchases/InwardDetailPage.tsx", "grn"),
    ("purchases/AdhocInvoiceDetailPage.tsx", "invoice"),
    ("sales/OrderConfirmationDetailPage.tsx", "oc"),
    ("purchases/ServiceConfirmationDetailPage.tsx", "sc"),
    ("purchases/InvoiceDetailPage.tsx", "invoice"),
    ("purchases/OrderConfirmationPurchaseDetailPage.tsx", "oc"),
]

BASEDIR = "/home/indalbind/Desktop/SE_G_project/QuadStack/apps/web/src/pages"

for file, data_var in FILES:
    filepath = os.path.join(BASEDIR, file)
    if not os.path.exists(filepath):
        print(f"Skipping {file}, does not exist")
        continue
    
    with open(filepath, "r") as f:
        content = f.read()

    # 1. Add import
    if "DocumentTabsSection" not in content:
        content = re.sub(
            r"(import .* from '@ant-design/icons';)",
            r"\1\nimport DocumentTabsSection from '@/components/shared/DocumentTabsSection';",
            content
        )
        print(f"Added import to {file}")

    # 2. Add Component before Bottom Action Buttons
    # Pattern to find: {/* Bottom Action Buttons */} or {/* Bottom Actions */} and ensure it's not already there
    if "DocumentTabsSection mode=\"view\"" not in content:
        injection = f"""
            {{/* Document Tabs (view mode) */}}
            {{!isEditing && {data_var} && (
                <div className="mt-6 no-print">
                    <DocumentTabsSection
                        mode="view"
                        value={{{{
                            extra_charges: {data_var}.extra_charges || [],
                            attachments: {data_var}.attachments || [],
                            terms_conditions: {data_var}.terms_conditions || '',
                            notes: {data_var}.notes || '',
                            comments: {data_var}.comments || [],
                            additional_details: {data_var}.additional_details || [],
                            signature_data: {data_var}.signature_data || null,
                        }}}}
                        onChange={{() => {{}}}}
                    />
                </div>
            )}}

            {{/* Bottom Action Buttons */}}"""
        
        # We will try to replace {/* Bottom Action Buttons */} or similar
        content = content.replace("            {/* Bottom Action Buttons */}", injection)
        # Sometime it's called {/* Bottom Actions */}
        content = content.replace("            {/* Bottom Actions */}", injection)

        print(f"Injected component in {file}")

    with open(filepath, "w") as f:
        f.write(content)

print("Done")
