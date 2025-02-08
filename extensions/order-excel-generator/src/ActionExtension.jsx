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


const skuNames = {
  WBAS: "WHITE BASMATI RICE",
  YBAS: "YELLO BASMATI RICE",
  BBAS: "BROWN BASMATI RICE",
  VERM: "VERMICELLI NOODLE",
  PAS: "PASTA",
  SAL: "SALAD",
  RPAT: "Roasted Sweet Potato",
  WPAT: "White Patatoes",
  BRK: "Breakfast",
  SOU: "Soup",
  BUR: "Burgers",
  MISC: "miscellaneous",
  WRP: "Wraps",
  SAU: "Sauce",
  SNK: "Snack",
  COK: "Cookies",
  GIFT25: "Gift Card $25",
  GIFT50: "Gift Card $50",
  GIFT100: "Gift Card $100",
  GIFT200: "Gift Card $200",
  DRS: "Dressing",
  JUC: "Juices"
}

async function getOrders(ids) {
  // console.log("ids", ids);

  const orderIDs = ids.map((d) => d?.id)
  // console.log("orderIDs", orderIDs);

  const res = await fetch('shopify:admin/api/graphql.json', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        query MyQuery {
        nodes(ids: ${JSON.stringify(orderIDs)}) {
          ... on Order {
            id
            customAttributes {
              key
              value
            }
            lineItems(first: 250) {
              nodes {
                sku
                currentQuantity
                variant {
                  product {
                    id
                    title 
                    tags
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
  const filteredData = data?.data?.nodes.map(data => {
    const validLineItems = data.lineItems.nodes.filter(d => {
      return !(d.variant && d?.variant?.product?.tags.includes('bundleProduct'));
    });

    return validLineItems?.length > 0 ? { ...data, lineItems: { nodes: validLineItems } } : null;
  }).filter(d => d !== null);

  console.log("filteredData", filteredData);
  return filteredData
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
        // console.log("item===========>", item);
        if (item?.variant) {
          const sku = item.sku || "OTHER";
          const productId = item.variant.product.id;
          const productTitle = item.variant.product.title;
          const selectedOptionKey = item.variant.selectedOptions.map(option => option.value).join('/');
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
        }
      });
    });

    return result;
  }

  function downloadExcel(selectedOrders) {
    const groupedOrders = groupOrdersBySKU(selectedOrders);
    console.log("groupedOrders", groupedOrders);

    const headers = ["MEAL"];
    const allQuantityKeys = new Set();

    // extracting all possidble quantity keys (option types)
    Object.values(groupedOrders).forEach(products => {
      Object.values(products).forEach(product => {
        Object.keys(product.quantity).forEach(key => {
          // checking if the quantity keys value is "Default Title"
          if (product.quantity[key] === "Default Title") {
            // if it is, add "QTY" to the set instead of the original key
            allQuantityKeys.add("QTY");
          } else {
            // else original key
            allQuantityKeys.add(key);
          }
        });
      });
    });

    // converting allQuantityKeys to the array and inserting "QTY" after "MEAL"
    const quantityKeys = Array.from(allQuantityKeys);
    // console.log("quantityKeys", quantityKeys);

    // removing "Default Title" from the keys and only pushing "QTY" in the headers
    headers.push("QTY");
    headers.push(...quantityKeys.filter(key => key !== "Default Title" && key !== "QTY"));
    headers.push("Total QTY");

    // console.log("Updated headers:", headers);

    const sheetData = [];

    // adding a row for the date
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    sheetData.push([
      {
        v: new Date().toLocaleDateString('en-GB', options).replace(',', ''),
        s: { font: { bold: true, sz: 14 }, alignment: { horizontal: "center" } }
      },
      ...Array(headers.length - 1).fill("")
    ]);

    // adding headers row with styling
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

    // populating SKU and products
    Object.entries(groupedOrders).forEach(([sku, products]) => {
      const skuName = skuNames[sku] || sku;
      // console.log("skuName", skuName, "sku", sku);

      // adding SKU section row as Highlighted Yellow)
      sheetData.push([
        {
          v: skuName,
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
        const row = Array(headers.length).fill(""); // empty row
        let totalQuantity = 0; // variable to store the total quantity for this row

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

        // fillings quantity data in the selected options key
        Object.entries(product.quantity).forEach(([key, value]) => {
          // if "Default Title" then we will use "QTY" 
          const adjustedKey = (key === "Default Title") ? "QTY" : key;
          const index = headers.indexOf(skuNames[adjustedKey] ? skuNames[adjustedKey] : adjustedKey);
          console.log("index", index, "key", key, "value", value, "adjustedKey", adjustedKey);

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

            // add the value to the total quantity (assuming value is a number)
            totalQuantity += Number(value);
          }
        });

        // Addings the total quantity to the last column "Total QTY"
        const totalQTYIndex = headers.indexOf("Total QTY");
        if (totalQTYIndex !== -1) {
          row[totalQTYIndex] = {
            v: totalQuantity,
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

        sheetData.push(row);
      });
    });

    // creating a worksheet
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
      title='Generate Orders Excel'
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
