import {
   NativeModules,
   Platform
} from "react-native";
import { EventHandlingHelper } from "react-native-common-utils";

const bt = NativeModules.SimpleBluetoothManager;

export default class BluetoothDevice {
   constructor(id) {
      this._id = id || "";
      
      this._eventHandlingHelper = new EventHandlingHelper({
         object: this,
         nativeModule: bt,
         eventGroups: [ "connectionState", "gatt" ],
         innerListener: this._innerListener
      });
      
      this._requests = {
         read: [],
         write: []
      };
      
      this._failureHandler = console.log;
      this._notifiedCharacteristics = {};
   }
   
   getId() {
      return this._id;
   }
   
   isConnected() {
      return !!this._connected;
   }
   
   areServicesDiscovered() {
      return !!this._servicesDiscovered;
   }
   
   isShutdownRequested() {
      return !!this._shutdownRequested;
   }
   
   flushRequests(read) {
      if (read == true || read == undefined) {
         this._requests.read.length = 0;
      }
      
      if (read == false || read == undefined) {
         this._requests.write.length = 0;
      }
   }
   
   setFailureHandler(failureHandler) {
      this._failureHandler = failureHandler;
   }
   
   setReadWriteTimeoutHandler(readWriteTimeoutHandler) {
      this._readWriteTimeoutHandler = readWriteTimeoutHandler;
      
      return this;
   }
   
   isValid() {
      return bt.isValid(this.getId());
   }
   
   async connectGatt() {
      this._throwIfShutdownRequested();
      
      this._connectionOptions = arguments.length ? arguments[0].constructor ==
         Boolean ? { autoConnect: arguments[0] } : arguments[0] : {};
      
      [
         "autoConnect",
         "autoDiscoverServices",
         "autoDiscoverServicesUseCache"
      ].forEach(key => !this._connectionOptions.hasOwnProperty(key)
         && (this._connectionOptions[key] = true));
      
      console.log(`BluetoothDevice.connectGatt('${this.getId()
         }', ${JSON.stringify(this._connectionOptions)}).`);
      
      await bt.connectGatt(this.getId(), this._connectionOptions.autoConnect);
   }
   
   async connect() {
      this._throwIfShutdownRequested();
      
      return await bt.connect(this.getId());
   }
   
   async openConnection(options = {}) {
      [
         "invokeBTGattConnect",
         "invokeBTGattDisconnect"
      ].forEach(key => !options.hasOwnProperty(key) && (options[key] = true));
      
      await this.connectGatt(options);
      
      return options.invokeBTGattConnect && Platform.
         OS == "android" ? await this.connect() : undefined;
   }
   
   async discoverServices(useCache = true) {
      this._throwIfShutdownRequested();
      
      await bt.discoverServices(this.getId(), useCache);
   }
   
   async readCharacteristic(serviceUuid, characteristicUuid, options) {
      this._throwIfShutdownRequested();
      
      await this._safeReadWrite(true, arguments);
   }
   
   async writeCharacteristic(
      serviceUuid,
      characteristicUuid,
      dataAndOptions,
      timeout)
   {
      this._throwIfShutdownRequested();
      
      const args = [
         serviceUuid,
         characteristicUuid,
         dataAndOptions
      ];
      
      if (!dataAndOptions
         || (dataAndOptions.chunkSize == undefined)
         || !Array.isArray(dataAndOptions.value)
         || dataAndOptions.value.length <= dataAndOptions.chunkSize)
      {
         await this._safeReadWrite(false, args, timeout);
      } else {
         if (dataAndOptions.chunkSize <= 0) {
            throw new Error(`dataAndOptions.chunkSize (${
               dataAndOptions.chunkSize}) can't be <= 0`);
         }
         
         for (let i = 0; i < dataAndOptions.value.length;) {
            args[2] = Object.assign({}, dataAndOptions, {value: dataAndOptions.value.slice(i, i += dataAndOptions.chunkSize)});
            
            await this._safeReadWrite(false, args, timeout);
         }
      }
   }
   
   async setCharacteristicNotification(
      serviceUuid,
      characteristicUuid,
      enable,
      options)
   {
      this._throwIfShutdownRequested();
      
      if (!enable) {
         const position = this._notifiedCharacteristics
            [serviceUuid].indexOf(characteristicUuid);
         
         if (position != -1) {
            this._notifiedCharacteristics[serviceUuid].splice(position, 1);
            
            if (!this._notifiedCharacteristics[serviceUuid].length) {
               delete this._notifiedCharacteristics[serviceUuid];
            }
         }
      }
      
      await this._setCharacteristicNotification(
         serviceUuid, characteristicUuid, enable, options);
      
      if (enable) {
         if (!this._notifiedCharacteristics[serviceUuid]) {
            this._notifiedCharacteristics[serviceUuid] = [];
         }
         
         this._notifiedCharacteristics[serviceUuid].push(characteristicUuid);
      }
   }
   
   async readDescriptor(
      serviceUuid,
      characteristicUuid,
      descriptorUuid,
      options)
   {
      this._throwIfShutdownRequested();
      
      await this._safeReadWrite(true, arguments);
   }
   
   async writeDescriptor(
      serviceUuid,
      characteristicUuid,
      descriptorUuid,
      dataAndOptions)
   {
      this._throwIfShutdownRequested();
      
      await this._safeReadWrite(false, arguments);
   }
   
   async readSerialNumber() {
      const isAndroid = Platform.OS == "android";
      
      await this.readCharacteristic(
         isAndroid ? "0000180A-0000-1000-8000-00805F9B34FB" : "180A",
         isAndroid ? "00002A25-0000-1000-8000-00805F9B34FB" : "2A25", {
            asString: true
         }
      );
   }
   
   async disconnect() {
      this._throwIfShutdownRequested();
      
      await this._disconnect();
   }
   
   async closeGatt() {
      this._throwIfShutdownRequested();
      
      await this._closeGatt();
   }
   
   async shutdown(timeout = 10000) {
      this._throwIfShutdownRequested();
      
      this._shutdownRequested = true;
      
      this._eventHandlingHelper.removeListeners();
      
      if (!this.isConnected()) {
         console.log(`Shutting down a disconnected BluetoothDevice connection with '${this.getId()}'.`);
         
         this._eventHandlingHelper.removeInnerListeners();
         
         try {
            if (
               this._connectionOptions.invokeBTGattDisconnect
               && Platform.OS == "android")
            {
               await this._disconnect();
            }
            
            await this._closeGatt();
         } catch (error) {
            this._failureHandler(error);
         }
      } else {
         for (let srvcUuid of Object.keys(this._notifiedCharacteristics)) {
            for (let chrctrstcUuid of this._notifiedCharacteristics[srvcUuid]) {
               this._setCharacteristicNotification(
                  srvcUuid,
                  chrctrstcUuid,
                  false)
               .catch(this._failureHandler);
            }
         }
         
         if (!this._requests.read.length && !this._requests.write.length) {
            timeout = 0;
         }
         
         await new Promise(resolve => setTimeout(resolve, timeout));
         
         console.log(`Shutting down a BluetoothDevice connection with '${this.getId()}'. R/W requests pending: ${this._requests.read.length + this._requests.write.length}.`);
         
         try {
            if (Platform.OS == "ios") {
               await this._closeGatt();
            } else if (this._connectionOptions.invokeBTGattDisconnect) {
               await this._disconnect();
            } else {
               this._eventHandlingHelper.removeInnerListeners();
               await this._closeGatt();
            }
         } catch (error) {
            this._failureHandler(error);
         }
      }
   }
   
   async _safeReadWrite(read, params = [], timeout) {
      const operation = read ? "read" : "write";
      const requests = this._requests[operation];
      
      let request;
      
      if (!params.length) {
         requests.shift();
         request = requests[0];
         
         if (this._safeReadWriteTimeoutId) {
            clearTimeout(this._safeReadWriteTimeoutId);
            
            this._safeReadWriteTimeoutId = 0;
         }
      } else {
         request = {
            serviceUuid: params[0],
            characteristicUuid: params[1],
            obj: params[params.length - 1],
            timeout
         };
         
         if (params.length == 4) {
            request.descriptorUuid = params[2];
         };
      }
      
      if (request != undefined && (!params.length || !requests.length)) {
         const ar = [
            this.getId(),
            request.serviceUuid,
            request.characteristicUuid,
         ];
         
         const descrOp = request.hasOwnProperty("descriptorUuid");
         
         if (descrOp) {
            ar.push(request.descriptorUuid);
         }
         
         ar.push(request.obj);
         
         await bt[operation + (descrOp ? "Descriptor" :
            "Characteristic")].apply(null, ar);
         
         if (request.timeout > 0) {
            this._safeReadWriteTimeoutId = setTimeout(() => {
               if (this._readWriteTimeoutHandler) {
                  this._readWriteTimeoutHandler();
               }
            }, request.timeout);
         }
      }
      
      params.length && requests.push(request);
   }
   
   _withError(data) {
      return data.error ? ` with error ${data.status}` : "";
   }
   
   _innerListener(data) {
      if (data.id.valueOf() == this.getId()) {
         switch (data.eventName) {
            case bt.events.connectionState.CONNECTED:
               console.log(`BluetoothDevice connected (${this.
                  getId()})${this._withError(data)}.`);
               
               this._connected = !data.error;
               
               if (
                  this.isConnected()
                  && this._connectionOptions.autoDiscoverServices)
               {
                  this.discoverServices(this._connectionOptions.
                     autoDiscoverServicesUseCache).catch(this._failureHandler);
               }
               
               break;
            
            case bt.events.connectionState.DISCONNECTED:
               console.log(`BluetoothDevice disconnected (${this.
                  getId()})${this._withError(data)}.`);
               
               this._connected = false;
               this._servicesDiscovered = false;
               
               this.flushRequests();
               
               if (this.isShutdownRequested()) {
                  this._eventHandlingHelper.removeInnerListeners();
                  
                  if (Platform.OS == "android") {
                     this._closeGatt().catch(this._failureHandler);
                  }
               }
               
               break;
            
            case bt.events.gatt.SERVICES_DISCOVERED:
               console.log(`BluetoothDevice services discovered (${this.
                  getId()})${this._withError(data)}.`);
               
               this._servicesDiscovered = !data.error;
               
               break;
         }
         
         this._eventHandlingHelper.invokeListeners(data);
         
         const read =
            (data.eventName == bt.events.gatt.CHARACTERISTIC_READ
            || data.eventName == bt.events.gatt.DESCRIPTOR_READ) ? true :
            
            (data.eventName == bt.events.gatt.CHARACTERISTIC_WRITTEN
            || data.eventName == bt.events.gatt.DESCRIPTOR_WRITTEN) ? false :
            
            null;
         
         if (read != null) {
            this._safeReadWrite(read).catch(this._failureHandler);
         }
      }
   }
   
   async _disconnect() {
      await bt.disconnect(this.getId());
   }
   
   async _closeGatt() {
      await bt.closeGatt(this.getId());
   }
   
   async _setCharacteristicNotification(
      serviceUuid,
      characteristicUuid,
      enable,
      options)
   {
      await bt.setCharacteristicNotification(this.getId(),
         serviceUuid, characteristicUuid, enable, options);
      
      if (Platform.OS == "android") {
         await this._safeReadWrite(false, [
            serviceUuid,
            characteristicUuid,
            "00002902-0000-1000-8000-00805f9b34fb",
            {value: [+enable, 0]}
         ]);
      }
   }
   
   _throwIfShutdownRequested() {
      if (this.isShutdownRequested()) {
         throw new Error(`Connection shutdown was requested for '${this.getId()}'`);
      }
   }
}
