import { useEffect, useState } from 'react';
import {
  reactExtension,
  useApi,
  AdminAction,
  BlockStack,
  Button,
  Text,
  ChoiceList,
} from '@shopify/ui-extensions-react/admin';
import * as XLSX from "xlsx-js-style";
// import { Link } from '@shopify/ui-extensions/admin';


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
            note
            shippingAddress {
              address1
              address2
              city
              country
              countryCodeV2
              firstName
              lastName
              formattedArea
              name
              phone
              province
              provinceCode
              zip
              countryCode
            }
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
  // console.log("dataa", data)
  // console.log("data.data.nodes", data.data.nodes);
  const filteredData = data?.data?.nodes.map(data => {
    const validLineItems = data.lineItems.nodes.filter(d => {
      return !(d.variant && d?.variant?.product?.tags.includes('bundleProduct'));
    });
    return validLineItems?.length > 0 ? { ...data, lineItems: { nodes: validLineItems } } : null;
  }).filter(d => d !== null);
  // console.log("filteredData", filteredData);
  return filteredData
}

const TARGET = 'admin.order-index.selection-action.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const { data } = useApi(TARGET);
  const selectedOrderIds = data.selected;
  const [selectedOrders, setSelectedOrders] = useState()
  const [isLoadingButton, setLoadingButton] = useState(true)
  // const [downloadLink, setDownloadLink] = useState("")
  const [selectedOption, setSelectedOption] = useState("orders")

  function groupOrdersBySKU(orders) {
    const result = {};
    // console.log("before forEach orders=========>", orders);
    orders.forEach(order => {
      // console.log("before forEach  order.lineItems.nodes====>", order?.lineItems?.nodes);
      order.lineItems.nodes.forEach(item => {
        // console.log("inside forEach item===========>", item);
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

  const handleOrdersFileGenerate = () => {
    const groupedOrders = groupOrdersBySKU(selectedOrders);
    // console.log("before forEach groupedOrders", groupedOrders);
    const headers = ["MEAL"];
    const allQuantityKeys = new Set();
    // extracting all possidble quantity keys (option types)
    Object.values(groupedOrders).forEach(products => {
      // console.log("before forEach products", products);
      Object.values(products).forEach(product => {
        // console.log("before forEach product?.quantity", product?.quantity);
        Object.keys(product.quantity).forEach(key => {
          // checking if the quantity keys value is "Default Title"
          if (product.quantity[key] === "Default Title") {
            // if it is adding "QTY" to the set instead of the original key
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
      // console.log("before forEach products", products);
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
        // console.log("before forEach product.quantity", product.quantity);
        Object.entries(product.quantity).forEach(([key, value]) => {
          // if "Default Title" then we will use "QTY" 
          const adjustedKey = (key === "Default Title") ? "QTY" : key;
          const index = headers.indexOf(skuNames[adjustedKey] ? skuNames[adjustedKey] : adjustedKey);
          // console.log("index", index, "key", key, "value", value, "adjustedKey", adjustedKey);
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
    ws['!cols'] = [
      { wch: 30 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
    // downloadawble file URI
    const fileUri = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${excelBuffer}`;
    return fileUri
  }

  const handleShippingFileGenerate = () => {
    const headers = [
      "Order ID", "First Name", "Last Name", "Phone", "Country", "City",
      "Province", "Address Line 1", "Address Line 2", "ZIP Code", "Note"
    ];
    const sheetData = [headers];
    selectedOrders.forEach((order) => {
      const orderID = order.id.split("/").pop();
      const shipping = order.shippingAddress;
      sheetData.push([
        orderID,
        shipping.firstName || "N/A",
        shipping.lastName || "N/A",
        shipping.phone || "N/A",
        shipping.country || "N/A",
        shipping.city || "N/A",
        shipping.province || "N/A",
        shipping.address1 || "N/A",
        shipping.address2 || "N/A",
        shipping.zip || "N/A",
        order.note || "N/A"
      ]);
    });

    // converting array of arrays to worksheet
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // settinga column widths (using character count)
    ws['!cols'] = [
      { wch: 15 }, // for Order ID
      { wch: 15 }, // for First Name
      { wch: 15 }, // for Last Name
      { wch: 15 }, // for  Phone
      { wch: 15 }, // fora Country
      { wch: 15 }, // for City
      { wch: 15 }, // for Province
      { wch: 20 }, // for Address Line 1
      { wch: 20 }, // for Address Line 2
      { wch: 10 }, // for ZIP Code
      { wch: 25 }  // for Note
    ];

    // defining a professional header style
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "4F81BD" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } }
      }
    };

    // applying the header style to each cell in the first row (headers)
    for (let col = 0; col < headers.length; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (ws[cellAddress]) {
        ws[cellAddress].s = headerStyle;
      }
    }

    // creating a new workbook and append the worksheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");

    // Write the workbook and generate a base64 buffer
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
    const fileUri = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${excelBuffer}`;
    return fileUri;
  };

  function generateExcel() {
    console.log("Process started....")
    setLoadingButton(true)
    if (selectedOption === "orders") {
      const ordersFileURI = handleOrdersFileGenerate()
      console.log("download URL ===============>  ", ordersFileURI);
      // setDownloadLink(ordersFileURI)
    } else {
      const shippingFileURI = handleShippingFileGenerate()
      console.log("download URL ===============>  ", shippingFileURI);
      // setDownloadLink(shippingFileURI)
    }
    setLoadingButton(false)
  }

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const data = await getOrders(selectedOrderIds);
        setSelectedOrders(data)
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoadingButton(false)
      }
    };
    fetchOrders();
  }, [selectedOrderIds]);

  // const copyTextToClipboard = async () => {
  //   if (!navigator?.clipboard) {
  //     console.log("navigator not found..........s");
  //     return;
  //   }
  //   try {
  //     console.log("downloadLink",downloadLink);

  //     await navigator.clipboard.writeText(downloadLink);
  //   } catch (error) {
  //     console.error('Error copying text: ', error);
  //   }
  // };

  return (
    <AdminAction
      title='Generate Orders Excel'
      children={<>
        <ChoiceList
          name="Please select a file type"
          choices={[
            { label: 'Orders excel file', id: 'orders' },
            { label: 'Shipping excel file', id: 'shipping' },
          ]}
          onChange={(v) => setSelectedOption(v)}
          value={selectedOption}
        />
        {/* {downloadLink ? <Link href={downloadLink}>
          Click here to download
        </Link> : null} */}
      </>}
      primaryAction={
        <Button
          // download
          disabled={isLoadingButton}
          // href={downloadLink}
          onPress={generateExcel}
        >
          {isLoadingButton ? "Please wait..." : "Generate Excel File"}
        </Button>
      }
    >
    </AdminAction>
  );


}
