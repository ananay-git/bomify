#!/bin/bash

# List of files to update
FILES=(
  "purchases/CreateInvoicePage.tsx"
  "purchases/CreateInwardPage.tsx"
  "purchases/CreateSalesOrderPage.tsx"
  "purchases/CreateServiceConfirmationPage.tsx"
  "purchases/CreateServiceOrderPage.tsx"
  "purchases/CreateAdhocInvoicePage.tsx"
  "sales/CreateOrderConfirmationPage.tsx"
)

BASEDIR="/home/indalbind/Desktop/SE_G_project/QuadStack/apps/web/src/pages"

for FILE in "${FILES[@]}"; do
  FILEPATH="$BASEDIR/$FILE"
  echo "Processing: $FILE"
  
  # 1. Add import after the first '@ant-design/icons' import line (if not already added)
  if ! grep -q "DocumentTabsSection" "$FILEPATH"; then
    # Find the line with @ant-design/icons import and add our import after it
    sed -i "/@ant-design\/icons/a import DocumentTabsSection, { EMPTY_TABS_DATA, DocumentTabsData } from '@/components/shared/DocumentTabsSection';" "$FILEPATH"
    echo "  Added import"
  fi
  
  # 2. Add state declaration after the function component's useState declarations
  if ! grep -q "documentTabsData" "$FILEPATH"; then
    # Add state after the last useState line that contains 'placeOfSupply' or 'priceType' or 'selectedOptional'
    sed -i '/const \[selectedOptionalColumns/a\    const [documentTabsData, setDocumentTabsData] = useState<DocumentTabsData>(EMPTY_TABS_DATA);' "$FILEPATH" 2>/dev/null || \
    sed -i '/const \[priceType/a\    const [documentTabsData, setDocumentTabsData] = useState<DocumentTabsData>(EMPTY_TABS_DATA);' "$FILEPATH" 2>/dev/null
    echo "  Added state"
  fi
  
  # 3. Replace the tabItems Tabs usage with DocumentTabsSection
  sed -i 's|<Tabs type="card" items={tabItems} className="custom-tabs" />|<DocumentTabsSection mode="create" value={documentTabsData} onChange={setDocumentTabsData} />|g' "$FILEPATH"
  echo "  Replaced Tabs component"
  
  echo "  Done: $FILE"
done

echo "All files processed!"
