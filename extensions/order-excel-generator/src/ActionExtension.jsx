import { useEffect, useState } from 'react';
import {
  reactExtension,
  useApi,
  AdminAction,
  BlockStack,
  Button,
  Text,
} from '@shopify/ui-extensions-react/admin';
import * as XLSX from "xlsx";


async function getOrders(ids) {
  console.log("ids", ids);

  const orderIDs = ids.map((d) => d?.id)
  console.log("orderIDs", orderIDs);

  const res = await fetch('shopify:admin/api/graphql.json', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        query MyQuery {
        nodes(ids: ${JSON.stringify(orderIDs)}) {
          ... on Order {
            id
            lineItems(first: 250) {
              nodes {
                sku
                currentQuantity
                variant {
                  product {
                    title
                  }
                  selectedOptions {
                    name
                    value
                  }
                }
              }
            }
          }
        }
      }
      `
    }),
  });
  const data = await res.json();
  console.log("dataa", data)
  console.log("data.data.nodes", data.data.nodes);
  return data.data.nodes
}


const TARGET = 'admin.order-index.selection-action.render';

export default reactExtension(TARGET, () => <App />);

function App() {

  const { data } = useApi(TARGET);
  const [selectedOrders, setSelectedOrders] = useState()


  const selectedOrderIds = data.selected;

  // function downloadExcel() {
  //   const data = [
  //     ["Name", "Other", "Program", "Option", "Meal", "Container", "Size"], // Headers for the columns
  //   ];

  //   // Sample data provided
  //   const selectedOrders = [
  //     {
  //       "id": "gid://shopify/Order/5937880858860",
  //       "lineItems": {
  //         "nodes": [
  //           {
  //             "sku": null,
  //             "currentQuantity": 1,
  //             "variant": {
  //               "product": {
  //                 "title": "+ Protein Dinner Bundle"
  //               },
  //               "selectedOptions": [
  //                 {
  //                   "name": "Program",
  //                   "value": "Glow"
  //                 },
  //                 {
  //                   "name": "Option",
  //                   "value": "6 meal"
  //                 }
  //               ]
  //             }
  //           }
  //         ]
  //       }
  //     },
  //     {
  //       "id": "gid://shopify/Order/5937767743724",
  //       "lineItems": {
  //         "nodes": [
  //           {
  //             "sku": "YBAS",
  //             "currentQuantity": 1,
  //             "variant": {
  //               "product": {
  //                 "title": "Turkey Burrito Bowl"
  //               },
  //               "selectedOptions": [
  //                 {
  //                   "name": "meal",
  //                   "value": "reg"
  //                 }
  //               ]
  //             }
  //           },
  //           {
  //             "sku": "FBCP",
  //             "currentQuantity": 1,
  //             "variant": {
  //               "product": {
  //                 "title": "Blueberry Chia Pudding"
  //               },
  //               "selectedOptions": [
  //                 {
  //                   "name": "Container",
  //                   "value": "reg"
  //                 }
  //               ]
  //             }
  //           },
  //           {
  //             "sku": "SAL",
  //             "currentQuantity": 1,
  //             "variant": {
  //               "product": {
  //                 "title": "Winter Beet Salad"
  //               },
  //               "selectedOptions": [
  //                 {
  //                   "name": "meal",
  //                   "value": "chicken"
  //                 }
  //               ]
  //             }
  //           }
  //         ]
  //       }
  //     }
  //   ];

  //   selectedOrders.forEach(order => {
  //     order.lineItems.nodes.forEach(item => {
  //       let row = [];
  //       const sku = item.sku || "Unknown SKU";
  //       const productTitle = item.variant.product.title;
  //       const selectedOptions = item.variant.selectedOptions;

  //       row.push(sku);
  //       row.push(productTitle);

  //       const other = selectedOptions.length === 0 ? "No Selection" : "";
  //       row.push(other);

  //       selectedOptions.forEach(option => {
  //         row.push(option.value);
  //       });

  //       data.push(row);
  //     });
  //   });

  //   // Create a worksheet from the data array
  //   const ws = XLSX.utils.aoa_to_sheet(data);

  //   // Create a new workbook
  //   const wb = XLSX.utils.book_new();
  //   XLSX.utils.book_append_sheet(wb, ws, "Orders");

  //   // Write the workbook as a binary string
  //   const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "base64" });

  //   // Create a data URI for download
  //   const fileUri = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${excelBuffer}`;
  //   console.log("fileUri", fileUri);

  //   // Open the file in a new tab (fallback if download isn't allowed)
  //   window.open(fileUri);
  // }

  function downloadExcel(selectedOrders) {
    const categories = {};
  
    // Process the data to categorize by SKU and collect dynamic headers
    const allSelectedOptionKeys = new Set();
  
    selectedOrders.forEach((order) => {
      order.lineItems.nodes.forEach((item) => {
        const sku = item.sku || "Other"; // Group items without SKU under 'Other'
        const productName = item.variant.product.title;
        const selectedOptions = item.variant.selectedOptions.reduce((acc, option) => {
          acc[option.name] = option.value;
          allSelectedOptionKeys.add(option.name); // Collect unique option keys for dynamic headers
          return acc;
        }, {});
  
        if (!categories[sku]) {
          categories[sku] = [];
        }
  
        categories[sku].push({
          name: productName,
          ...selectedOptions,
          quantity: item.currentQuantity,
        });
      });
    });
  
    // Create dynamic headers
    const dynamicHeaders = Array.from(allSelectedOptionKeys);
    const headers = ["Category (SKU)", "Name", ...dynamicHeaders];
  
    // Prepare data rows based on dynamic headers
    const data = [headers];
  
    Object.keys(categories).forEach((sku) => {
      categories[sku].forEach((item) => {
        const row = [sku, item.name];
        dynamicHeaders.forEach((key) => {
          // Assign quantity to the corresponding dynamic header or leave empty
          row.push(item[key] === undefined ? "" : `${item.quantity}`);
        });
        data.push(row);
      });
    });
  
    // Create a worksheet
    const ws = XLSX.utils.aoa_to_sheet(data);
  
    // Create a new workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
  
    // Write workbook as binary string
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  
    // Create a blob for download
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  
    // Create a download link
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Orders.xlsx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  // Example usage
  downloadExcel(selectedOrders);
  
  
  
  



  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const data = await getOrders(selectedOrderIds);
        setSelectedOrders(data)
      } catch (error) {
        console.error('Error fetching orders:', error);
      }
    };

    fetchOrders();
  }, [selectedOrderIds]);

  return (

    <AdminAction
      primaryAction={
        <Button
          onPress={() => {
            downloadExcel()
          }}
        >
          Generate Excel File
        </Button>
      }
    >
    </AdminAction>
  );


}
