import {
   NativeModules,
   NativeEventEmitter,
   Platform
} from "react-native";

const bt = NativeModules.SimpleBluetoothManager;
const emitter = new NativeEventEmitter(bt);

export default class BluetoothDevice {
   constructor(id) {
      this._id = id || "";
      this._listeners = {};
      
      for (let group of [ "connectionState", "gatt" ]) {
         for (let eventType of Object.keys(bt.events[group])) {
            this._listeners[eventType] = { listeners: [] };
            
            const indices = [0];
            let index = -1;
            
            while ((index = eventType.indexOf("_", index + 1)) != -1) {
               indices.push(index);
            }
            
            let camelCased = Array.from(eventType.toLowerCase());
            
            for (let index of indices) {
               if (index) {
                  camelCased.splice(index, 1);
               }
               
               camelCased[index] = camelCased[index].toUpperCase();
            }
            
            camelCased = camelCased.join("");
            
            this[`addOn${camelCased}Listener`] = function(listener) {
               this._listeners[eventType].listeners.push(listener);
               
               return this;
            };
            
            this[`removeOn${camelCased}Listener`] = function(listener) {
               const index = this._listeners[eventType].listeners.indexOf(listener);
               
               if (index != -1) {
                  this._listeners[eventType].listeners.splice(index, 1);
               }
               
               return this;
            }
         }
      }
      
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
   
   isValid() {
      return bt.isValid(this.getId());
   }
   
   async connectGatt(autoConnect = true) {
      for (let eventType of Object.keys(this._listeners)) {
         this._listeners[eventType].innerListener = emitter.
            addListener(eventType, this._innerListener.bind(this))
      }
      
      await bt.connectGatt(this.getId(), autoConnect);
   }
   
   async discoverServices(useCache = true) {
      await bt.discoverServices(this.getId(), useCache);
   }
   
   async readCharacteristic(serviceUuid, characteristicUuid, options) {
      await this._safeReadWrite(true, arguments);
   }
   
   async writeCharacteristic(serviceUuid, characteristicUuid, dataAndOptions) {
      if (!dataAndOptions
         || (dataAndOptions.chunkSize == undefined)
         || !Array.isArray(dataAndOptions.value)
         || dataAndOptions.value.length <= dataAndOptions.chunkSize)
      {
         await this._safeReadWrite(false, arguments);
      } else {
         if (dataAndOptions.chunkSize <= 0) {
            throw new Error(`dataAndOptions.chunkSize (${
               dataAndOptions.chunkSize}) can't be <= 0`);
         }
         
         for (let i = 0; i < dataAndOptions.value.length;) {
            await this._safeReadWrite(false, [
               serviceUuid,
               characteristicUuid,
               Object.assign({}, dataAndOptions, {value: dataAndOptions.
                  value.slice(i, i += dataAndOptions.chunkSize)})
            ]);
         }
      }
   }
   
   async setCharacteristicNotification(
      serviceUuid,
      characteristicUuid,
      enable,
      options)
   {
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
      await this._safeReadWrite(true, arguments);
   }
   
   async writeDescriptor(
      serviceUuid,
      characteristicUuid,
      descriptorUuid,
      dataAndOptions)
   {
      await this._safeReadWrite(false, arguments);
   }
   
   async closeGatt() {
      for (let eventType of Object.keys(this._listeners)) {
         this._listeners[eventType].innerListener.remove();
      }
      
      await bt.closeGatt(this.getId());
   }
   
   shutdown() {
      this._shutdownRequested = true;
      
      for (let eventType of Object.keys(this._listeners)) {
         this._listeners[eventType].listeners.length = 0;
      }
      
      this.flushRequests();
      
      const notificationsToStop = [];
      
      for (let srvcUuid of Object.keys(this._notifiedCharacteristics)) {
         for (let characteristicUuid of this._notifiedCharacteristics[srvcUuid]) {
            notificationsToStop.push(this.setCharacteristicNotification.bind(
               this,
               srvcUuid,
               characteristicUuid,
               false));
         }
      }
      
      this._writeCallbacksToReceive = notificationsToStop.length;
      
      for (let notificationToStop of notificationsToStop) {
         notificationToStop().catch(error => {
            this._failureHandler(error);
            
            this._writeCallbacksToReceive--;
         });
      }
      
      if (!this._writeCallbacksToReceive || Platform.OS == "ios") {
         this.closeGatt().catch(this._failureHandler);
      }
   }
   
   async _safeReadWrite(read, params = []) {
      const operation = read ? "read" : "write";
      const requests = this._requests[operation];
      
      let request;
      
      if (!params.length) {
         requests.shift();
         request = requests[0];
      } else {
         request = {
            serviceUuid: params[0],
            characteristicUuid: params[1],
            obj: params[params.length - 1]
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
      }
      
      params.length && requests.push(request);
   }
   
   _innerListener(data) {
      if (data.id.valueOf() == this.getId()) {
         switch (data.eventName) {
            case bt.events.connectionState.CONNECTED:
               this._connected = !data.error;
               break;
            
            case bt.events.connectionState.DISCONNECTED:
               this._connected = false;
               this._servicesDiscovered = false;
               
               this.flushRequests();
               
               break;
            
            case bt.events.gatt.SERVICES_DISCOVERED:
               this._servicesDiscovered = !data.error;
               break;
         }
         
         for (let listener of this._listeners[data.eventName].listeners) {
            listener(data);
         }
         
         const read =
            (data.eventName == bt.events.gatt.CHARACTERISTIC_READ
            || data.eventName == bt.events.gatt.DESCRIPTOR_READ) ? true :
            
            (data.eventName == bt.events.gatt.CHARACTERISTIC_WRITTEN
            || data.eventName == bt.events.gatt.DESCRIPTOR_WRITTEN) ? false :
            
            undefined;
         
         if (read != undefined) {
            this._safeReadWrite(read).catch(this._failureHandler);
            
            if (!read && this._writeCallbacksToReceive) {
               this._writeCallbacksToReceive--;
               
               if (!this._writeCallbacksToReceive) {
                  this.closeGatt().catch(this._failureHandler);
               }
            }
         }
      }
   }
}
