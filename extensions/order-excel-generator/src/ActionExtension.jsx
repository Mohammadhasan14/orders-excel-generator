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
                    id
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

  function groupOrdersBySKU(orders) {
    const result = {};

    orders.forEach(order => {
      order.lineItems.nodes.forEach(item => {
        const sku = item.sku || "OTHER"; 
        const productId = item.variant.product.id;
        const productTitle = item.variant.product.title;
        const selectedOptionKey = item.variant.selectedOptions[0]?.value || "default";
        const quantity = item.currentQuantity;

        if (!result[sku]) {
          result[sku] = {};
        }

        if (!result[sku][productId]) {
          result[sku][productId] = {
            title: productTitle,
            quantity: {}
          };
        }

        if (!result[sku][productId].quantity[selectedOptionKey]) {
          result[sku][productId].quantity[selectedOptionKey] = 0;
        }

        result[sku][productId].quantity[selectedOptionKey] += quantity;
      });
    });

    return result;
  }

  function downloadExcel(selectedOrders) {
    const groupedOrders = groupOrdersBySKU(selectedOrders);
    console.log("groupedOrders",groupedOrders);
    

    // Defining headers
    const headers = ["MEAL", "QTY"]; // First column: Meal (Product Titles), rest: Quantity types
    const allQuantityKeys = new Set(); // Tracking unique quantity keys

    // Extsracting all possible quantity keys (option typess)
    Object.values(groupedOrders).forEach(products => {
      Object.values(products).forEach(product => {
        Object.keys(product.quantity).forEach(key => allQuantityKeys.add(key));
      });
    });

    // Converting Set to Array for headers
    const quantityKeys = Array.from(allQuantityKeys);
    console.log("quantityKeys", quantityKeys);

    headers.push(...quantityKeys);

    // Initializing sheet data with headers
    const sheetData = [];

    // Adding a row for the date
    sheetData.push([new Date(), ...Array(headers.length - 1).fill("")]); // Date row

    // Adding headers row
    sheetData.push(headers);

    // Populatings SKU and products
    Object.entries(groupedOrders).forEach(([sku, products]) => {
      // Adding SKU section row (Highlighted Yellow)
      sheetData.push([{ v: sku, s: { fill: { fgColor: { rgb: "FFFF00" } } } }]);

      Object.values(products).forEach(product => {
        const row = Array(headers.length).fill(""); // Empty row

        row[0] = product.title; // Product Title in First Column

        // Filling quantity data
        Object.entries(product.quantity).forEach(([key, value]) => {
          const index = headers.indexOf(key); // Finding inddex of quantity type
          if (index !== -1) row[index] = value;
        });

        sheetData.push(row);
      });
    });

    // Creating a worksheet
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Applying styling (e.g., bold for headers)
    const headerRange = XLSX.utils.decode_range(ws["!ref"]);
    for (let C = 0; C < headers.length; C++) {
      const cell = XLSX.utils.encode_cell({ r: 1, c: C });
      if (!ws[cell]) continue;
      ws[cell].s = { font: { bold: true } };
    }

    // Creating a new workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");

    // Writing workbook as base64
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "base64" });

    // Generating downloadable file URI
    const fileUri = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${excelBuffer}`;
    console.log("fileUri-+-+>", fileUri);
  }









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
      title='Generate order excel 70007'
      primaryAction={
        <Button
          onPress={() => {
            downloadExcel(selectedOrders)
          }}
        >
          Generate Excel File
        </Button>
      }
    >
    </AdminAction>
  );


}
