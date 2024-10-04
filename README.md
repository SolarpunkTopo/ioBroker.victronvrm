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












# Victron VRM Adapter for ioBroker

![Victron VRM Adapter](./images/header.png)

## **⚠️ Disclaimer**
**This adapter is in the early stages of development and is actively being worked on.** Features and functionalities may change, and the adapter may not be fully stable. Use it at your own risk and contribute to its improvement!

## **🔍 Short Summary**
The **Victron VRM Adapter** for **ioBroker** seamlessly integrates your Victron Energy devices with the ioBroker ecosystem. It leverages the Victron Remote Management (VRM) API to monitor and control your energy systems, utilizing Modbus for efficient communication and an SQLite database for reliable data storage. Additionally, the adapter offers optional webhook functionality for extended automation capabilities.

### **Key Features:**
- **Automatic Modbus Register Address Search:** Automatically discovers and maps Modbus register addresses from the integrated SQLite database.
- **Custom Settings Auto-Fill:** Simplifies configuration by automatically populating custom settings based on detected data points.
- **Optional Webhook Integration:** Enhance your setup with webhooks for real-time notifications and integrations.
- **SQLite Database Integration:** Reliable and efficient data storage for all your energy system metrics.

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

#### **Accessing the Adapter Settings:**
- Open the **ioBroker Admin Interface**.
- Navigate to **"Adapters"** and locate **"Victron VRM"**.
- Click the **"Settings"** (gear) icon to configure the adapter.

#### **Configuration Parameters:**

1. **VRM API Token (`VrmApiToken`):**
   - Enter your **Victron VRM API Token** for authentication.
   - **Note:** Alternatively, you can provide your **username** and **password** if you prefer not to use an API token.

2. **Username and Password:**
   - If not using an API token, provide your **Victron VRM** **username** and **password**.

3. **Polling Intervals:**
   - **Interval:** Set the main polling interval in seconds (default: 240).
   - **Interval2:** Secondary polling interval for specific tasks (default: 10).
   - **Interval3:** Tertiary polling interval for additional processes (default: 30).

4. **Database Path:**
   - The SQLite database file (`victronDBV02.db`) is located in the `./db/` directory within the adapter folder.
   - Ensure that this path is correctly set and that the adapter has read/write permissions.

5. **Webhook Configuration (Optional):**
   - Enable and configure webhooks for real-time integrations and notifications.
   - **Webhook URL:** Specify the endpoint to receive webhook events.
   - **Events to Trigger:** Select which events should trigger a webhook notification.

#### **Automatic Modbus Register Address Search:**

The adapter automatically scans the SQLite database (`victronDBV02.db`) to discover available Modbus registers associated with your Victron devices. This process populates the custom settings for each detected data point, streamlining the setup process.

**Steps:**

1. **Ensure Database Integrity:**
   - Verify that the `victronDBV02.db` file is present in the `./db/` directory.
   - The adapter will create the database file if it doesn't exist during the initial setup.

2. **Automatic Discovery:**
   - Upon starting, the adapter reads the database to identify available Modbus registers.
   - Custom settings for each data point are auto-populated based on the discovered registers, including parameters like `slaveId`, `registerAddress`, and `dataType`.

3. **Manual Verification:**
   - Access the database using an SQLite viewer to inspect the discovered registers.
   - Ensure that the custom settings align with your Modbus device specifications.

![Modbus Register Discovery](./images/modbus-discovery.png)

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

### **5. Preventing Self-Triggered Writes**

To avoid infinite loops where the adapter's own updates trigger additional write actions, the adapter employs a mechanism to differentiate between external and internal state changes.

**How It Works:**

- **Internal Updates:** When the adapter updates a data point, it marks the state as being updated internally.
- **State Change Handler:** The `onStateChange` handler checks if the change originated from the adapter itself and, if so, ignores it to prevent recursive writes.

**Example Scenario:**

1. **External Update:** A user changes a writable data point via the ioBroker interface.
2. **Adapter Action:** The `onStateChange` handler detects the change and writes the new value to the corresponding Modbus register.
3. **Internal Confirmation:** After writing, the adapter updates the state internally.
4. **Loop Prevention:** The internal update is recognized and ignored by the `onStateChange` handler, preventing an infinite loop.

![Self-Trigger Prevention](./images/self-trigger-prevention.png)

### **6. Troubleshooting**

#### **Common Issues:**

1. **Database File Not Found:**
   - **Solution:** Ensure that the `victronDBV02.db` file is present in the `./db/` directory. If not, the adapter should create it automatically. Check file permissions to ensure the adapter can read and write to the directory.

2. **Modbus Communication Errors:**
   - **Solution:** Verify the Modbus slave ID and register addresses in the custom settings. Ensure that the Modbus device is reachable and correctly configured.

3. **Webhook Failures:**
   - **Solution:** Check the webhook URL for correctness and ensure that the endpoint is accessible from the adapter's host machine. Review adapter logs for any HTTP errors.

4. **Adapter Not Starting:**
   - **Solution:** Review the adapter logs for any initialization errors, especially related to missing dependencies or incorrect configurations.

#### **Checking Logs:**
- Access the **ioBroker Admin Interface**.
- Navigate to **"Log"** to view detailed logs from the Victron VRM Adapter.
- Look for any error messages or warnings that can provide insights into issues.

### **7. Contribution and Support**

#### **Contributing:**
- Contributions are welcome! Please fork the repository and submit a pull request with your improvements.
- Ensure that your code follows the project's coding standards and includes appropriate documentation.

#### **Reporting Issues:**
- If you encounter any bugs or have feature requests, please open an issue in the [GitHub Issues](https://github.com/your-repo/victronvrm/issues) section.

#### **Support:**
- For support, join the [ioBroker Community](https://forum.iobroker.net/) and post your questions in the relevant section.

## **📸 Screenshots**

![Adapter Configuration](./images/configuration.png)
*Figure 1: Adapter Configuration Interface*

![Data Point Overview](./images/data-points.png)
*Figure 2: Overview of Created Data Points*

![Webhook Event](./images/webhook-event.png)
*Figure 3: Webhook Event Notification Example*

## **📜 License**
This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## **👤 Author**
**Your Name**  
[GitHub](https://github.com/your-username) | [Email](mailto:your-email@example.com)

---
**Thank you for using the Victron VRM Adapter for ioBroker!**  
Feel free to contribute and help improve the adapter as it evolves.














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