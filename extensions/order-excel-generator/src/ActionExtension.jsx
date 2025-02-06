import { useEffect, useState } from 'react';
import {
  reactExtension,
  useApi,
  AdminAction,
  BlockStack,
  Button,
  Text,
} from '@shopify/ui-extensions-react/admin';
import * as XLSX from "xlsx-js-style";


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
    console.log("groupedOrders", groupedOrders);

    const headers = ["MEAL", "QTY"]; 
    const allQuantityKeys = new Set(); 

    // Extractings all possible quantity keys (option types)
    Object.values(groupedOrders).forEach(products => {
      Object.values(products).forEach(product => {
        Object.keys(product.quantity).forEach(key => allQuantityKeys.add(key));
      });
    });

    const quantityKeys = Array.from(allQuantityKeys);
    console.log("quantityKeys",quantityKeys);
    
    headers.push(...quantityKeys);

    const sheetData = [];

    // Adding a row for the date
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    sheetData.push([
      {
        v: new Date().toLocaleDateString('en-GB', options).replace(',', ''),
        s: { font: { bold: true, sz: 14 }, alignment: { horizontal: "center" } }
      },
      ...Array(headers.length - 1).fill("")
    ]);

    // Adding headers row with styling
    sheetData.push(
      headers.map(header => ({
        v: header,
        s: {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "4F81BD" } }, 
          alignment: { horizontal: "center" },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
          }
        }
      }))
    );

    // Populating SKU and products
    Object.entries(groupedOrders).forEach(([sku, products]) => {
      // Adding SKU section row as Highlighted Yellow)
      sheetData.push([
        {
          v: sku,
          s: {
            font: { bold: true },
            fill: { fgColor: { rgb: "FFFF00" } },
            alignment: { horizontal: "left" },
            border: {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } }
            }
          }
        },
        ...Array(headers.length - 1).fill("")
      ]);

      Object.values(products).forEach(product => {
        const row = Array(headers.length).fill(""); // Empty row

        row[0] = {
          v: product.title,
          s: {
            font: { bold: false },
            alignment: { horizontal: "left" },
            border: {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } }
            }
          }
        };

        // Fillings quantity data
        Object.entries(product.quantity).forEach(([key, value]) => {
          const index = headers.indexOf(key); // Find index of quantity type
          if (index !== -1) {
            row[index] = {
              v: value,
              s: {
                alignment: { horizontal: "center" },
                border: {
                  top: { style: "thin", color: { rgb: "000000" } },
                  bottom: { style: "thin", color: { rgb: "000000" } },
                  left: { style: "thin", color: { rgb: "000000" } },
                  right: { style: "thin", color: { rgb: "000000" } }
                }
              }
            };
          }
        });

        sheetData.push(row);
      });
    });
    // console.log("sheetData",sheetData);
    
    // Creating a worksheet
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "base64" });

    // downloadawble file URI
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
      title='Generate Order Excel'
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
