![Logo](admin/victronvrm.png)
# ioBroker.victronvrm

[![NPM version](https://img.shields.io/npm/v/iobroker.victronvrm.svg)](https://www.npmjs.com/package/iobroker.victronvrm)
[![Downloads](https://img.shields.io/npm/dm/iobroker.victronvrm.svg)](https://www.npmjs.com/package/iobroker.victronvrm)

## victronvrm adapter for ioBroker

Data from the VRM Portal



## Changelog
<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->

### **WORK IN PROGRESS**
* (Topo) initial release
IN WORK! NO RELEASE



## [0.0.17] - 2024-09-30

### ✅ Added
- **VRM API Integration:** Successfully fetches and processes data from the Victron VRM portal.
- **Automatic Modbus Register Address Search:** Automatically discovers and maps Modbus register addresses based on data retrieved from the VRM portal.
- **Custom Settings Auto-Fill:** Automatically populates custom settings for each detected data point, simplifying configuration.
- **Optional Webhook Functionality:** Enables users to configure webhook URLs for real-time notifications and integrations with external services like IFTTT and Zapier.
- **Data Monitoring:** Continuously monitors Victron Energy devices, providing up-to-date energy metrics within ioBroker.

### ⚠️ Important Notes
- **Large Data Volume from VRM Portal:** The adapter retrieves a substantial amount of data from the VRM portal. Users should be aware that this may result in high memory usage and increased network traffic. It is recommended to monitor system performance and adjust polling intervals (`interval`) accordingly to optimize performance.

### 🛠️ Known Issues
- **Performance Optimization Needed:** Due to the large data volume, further optimization is required to ensure efficient data handling and minimal impact on system resources.
- **Incomplete Error Handling:** Some edge cases and error scenarios are not yet fully handled. Users might encounter unexpected behaviors under certain conditions.

### 🚧 Under Development
- **Enhanced Data Filtering:** Implementing more granular data filtering options to allow users to select specific data points of interest.
- **Advanced Webhook Features:** Adding support for more complex webhook configurations and multiple webhook endpoints.
- **User Interface Improvements:** Enhancing the adapter’s configuration interface for better usability and clarity.






# Victron VRM Adapter for ioBroker

![Victron VRM Adapter](./images/header.png)

## **⚠️ Disclaimer**
**This adapter is in the early stages of development and is actively being worked on.** Features and functionalities may change, and the adapter may not be fully stable. Use it at your own risk and contribute to its improvement!

## **🔍 Short Summary**
The **Victron VRM Adapter** for **ioBroker** seamlessly integrates your Victron Energy devices with the ioBroker ecosystem. It leverages the Victron Remote Management (VRM) API to monitor and control your energy systems, utilizing Modbus for efficient communication. Additionally, the adapter offers optional webhook functionality for extended automation capabilities.

### **Key Features:**
- **Automatic Modbus Register Address Search:** Automatically discovers and maps Modbus register addresses.
- **Custom Settings Auto-Fill:** Simplifies configuration by automatically populating custom settings based on detected data points.
- **Optional Webhook Integration:** Enhance your setup with webhooks for real-time notifications and integrations.

## **🛠 Detailed Setup and Configuration Guide**

### **1. Installation**

#### **Prerequisites:**
- **ioBroker** installed and running on your system.
- **Node.js** version compatible with ioBroker.
- **Victron VRM Account:** Ensure you have access to the Victron VRM API with the necessary credentials.

#### **Steps:**

1. **Download the Adapter:**
   - Navigate to the [ioBroker Admin Interface](https://iobroker.net/#en/documentation/adapter-manager/install).
   - Search for **"Victron VRM"** in the adapter list.
   - Click **"Install"** to add the adapter to your ioBroker setup.

2. **Manual Installation (Optional):**
   - Clone or download the adapter repository from [GitHub](https://github.com/your-repo/victronvrm).
   - Place the adapter folder in the `iobroker-data/iobroker.victronvrm/` directory.
   - Run `npm install` inside the adapter directory to install dependencies.

3. **Restart ioBroker:**
   - After installation, restart the ioBroker service to recognize the new adapter.

### **2. Configuration**



#### **Automatic Modbus Register Address Search:**

The adapter automatically scans available Modbus registers associated with your Victron devices. This process populates the custom settings for each detected data point, streamlining the setup process.

**Steps:**

1. **Automatic Discovery:**
   - Upon starting, the adapter scans and identifies available Modbus registers.
   - Custom settings for each data point are auto-populated based on the discovered registers, including parameters like `slaveId`, `registerAddress`, and `dataType`.

2. **Manual Verification:**
   - Access the adapter's data points within the ioBroker interface to inspect the discovered registers.
   - Ensure that the custom settings align with your Modbus device specifications.

![Modbus Register Discovery](./images/modbus-discovery.png)
*Figure 1: Modbus Register Discovery Process*

### **3. Custom Settings Auto-Fill**

To simplify the configuration, the adapter automatically fills in the custom settings for each data point that ends with `"rawValue"`. These settings include essential parameters required for Modbus communication.

**Included Custom Settings:**

- **enabled:** Indicates whether the data point is active.
- **writable:** Determines if the data point can be modified via Modbus.
- **slaveId:** The Modbus slave ID associated with the device.
- **registerAddress:** The specific register address for reading/writing data.
- **dataType:** The data type of the register (e.g., `int16`, `float32`).
- **useWebhook:** (Optional) Enables webhook notifications for changes.
- **getVariableName:** (Optional) Associates the data point with a specific variable name.

### **4. Optional Webhook Functionality**

Webhooks provide a mechanism to receive real-time notifications and integrate with other services or automation platforms.

#### **Enabling Webhooks:**

1. **Navigate to Webhook Settings:**
   - Within the adapter's configuration interface, locate the **Webhook** section.

2. **Configure Webhook URL:**
   - Enter the endpoint URL where you want to receive webhook notifications.

3. **Select Events:**
   - Choose the specific events that should trigger webhook notifications (e.g., data point changes, system alerts).

4. **Save and Apply:**
   - Save the configuration and restart the adapter if necessary.

#### **Using Webhooks:**

Once configured, the adapter will send HTTP POST requests to the specified webhook URL whenever the selected events occur. This enables seamless integration with services like **IFTTT**, **Zapier**, or custom automation scripts.

![Webhook Configuration](./images/webhook-configuration.png)
*Figure 2: Webhook Configuration Interface*

## **📸 Screenshots**

![Adapter Configuration](./images/configuration.png)
*Figure 3: Adapter Configuration Interface*

![Data Point Overview](./images/data-points.png)
*Figure 4: Overview of Created Data Points*

![Webhook Event](./images/webhook-event.png)
*Figure 5: Webhook Event Notification Example*

## **🔧 Advanced Configuration**

### **Automatic Modbus Register Address Search**

The adapter utilizes an internal mechanism to automatically discover and map Modbus register addresses. This feature eliminates the need for manual configuration of register addresses, ensuring that your Victron devices are accurately and efficiently monitored.

**Steps:**

1. **Register Discovery:**
   - The adapter periodically scans and identifies available Modbus registers based on the **Modbus Polling Interval** (`interval2`).
   - Detected Modbus registers are mapped to corresponding data points within ioBroker.

2. **Custom Settings Population:**
   - For each discovered register, the adapter automatically populates the custom settings (`custom.victronvrm`) with necessary parameters such as `slaveId`, `registerAddress`, and `dataType`.
   - This ensures that Modbus communication is correctly established without manual intervention.

### **Custom Settings Auto-Fill Mechanism**

The automatic population of custom settings simplifies the configuration process by dynamically adjusting to the discovered Modbus registers. This feature ensures that your data points are correctly associated with their respective registers, enabling seamless data retrieval and control.

**Features:**

- **Dynamic Association:** Automatically links data points to their corresponding Modbus registers based on the discovery process.
- **Error Handling:** Validates the existence and correctness of custom settings to prevent communication errors.
- **Flexibility:** Easily extendable to accommodate new data points and register mappings as your system evolves.

### **Optional Webhook Integration**

Webhooks enhance the adapter's functionality by enabling real-time communication with external services. This optional feature allows you to integrate your Victron Energy system with platforms like **IFTTT**, **Zapier**, or custom automation scripts for advanced control and notifications.

**Benefits:**

- **Real-Time Notifications:** Receive immediate alerts based on specific events or data point changes.
- **Automation:** Trigger automated workflows in response to changes in your energy system.
- **Integration:** Seamlessly connect with a wide range of third-party services to expand your system's capabilities.

## **📜 License**
This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## **👤 Author**
**SOlarPunkTopo**  
[GitHub](https://github.com/SolarPunkTopo) | [Email](mailto:your-email@example.com)












## License
MIT License

Copyright (c) 2024 Topo <balance2400@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.