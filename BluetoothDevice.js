import {
   NativeModules,
   NativeEventEmitter
} from "react-native";

const bt = NativeModules.SimpleBluetoothManager;
const emitter = new NativeEventEmitter(bt);

export default class BluetoothDevice {
   static Builder = class {
      constructor(id) {
         this.id = id || "";
         this.listeners = [];
      }
      
      setOnConnectedListener(l) {
         return this._addListener(bt.events.connectionState.CONNECTED, l);
      }
      
      setOnDisconnectedListener(l) {
         return this._addListener(bt.events.connectionState.DISCONNECTED, l);
      }
      
      setOnServicesDiscoveredListener(l) {
         return this._addListener(bt.events.gatt.SERVICES_DISCOVERED, l);
      }
      
      setOnCharacteristicReadListener(l) {
         return this._addListener(bt.events.gatt.CHARACTERISTIC_READ, l);
      }
      
      setOnCharacteristicWrittenListener(l) {
         return this._addListener(bt.events.gatt.CHARACTERISTIC_WRITTEN, l);
      }
      
      setOnCharacteristicChangedListener(l) {
         return this._addListener(bt.events.gatt.CHARACTERISTIC_CHANGED, l);
      }
      
      build() {
         return new BluetoothDevice(this);
      }
      
      _addListener(eventType, listener) {
         this.listeners.push({eventType, listener});
         
         return this;
      }
   };
   
   constructor(builder) {
      this.builder = builder;
      
      this.requests = {
         read: [],
         write: []
      };
      
      for (let listener of this.builder.listeners) {
         listener.innerListener = emitter.addListener(listener.
            eventType, this._innerListener.bind(this, listener));
      }
   }
   
   getId() {
      return this.builder.id;
   }
   
   isConnected() {
      return !!this.connected;
   }
   
   flushRequests(read) {
      if (read == true || read == undefined) {
         this.requests.read.length = 0;
      }
      
      if (read == false || read == undefined) {
         this.requests.write.length = 0;
      }
   }
   
   removeAllListeners() {
      this.builder.listeners.forEach(listener => listener.innerListener.remove());
   }
   
   isValid() {
      return bt.isValid(this.getId());
   }
   
   connectGatt(autoConnect = true) {
      return bt.connectGatt(this.getId(), autoConnect);
   }
   
   discoverServices(useCache = true) {
      return bt.discoverServices(this.getId(), useCache);
   }
   
   readCharacteristic(serviceUuid, characteristicUuid, options) {
      return this._safeReadWrite(true, arguments);
   }
   
   async writeCharacteristic(serviceUuid, characteristicUuid, dataAndOptions) {
      if (!dataAndOptions
         || (dataAndOptions.chunkSize == undefined)
         || !Array.isArray(dataAndOptions.value)
         || dataAndOptions.value.length <= dataAndOptions.chunkSize)
      {
         return await this._safeReadWrite(false, arguments);
      }
      
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
   
   closeGatt() {
      return bt.closeGatt(this.getId());
   }
   
   async _safeReadWrite(read, params) {
      const operation = read ? "read" : "write";
      const requests = this.requests[operation];
      
      const request = params.length ? {
         serviceUuid: params[0],
         characteristicUuid: params[1],
         obj: params[2]
      } : (requests.shift(), requests[0]);
      
      if (request != undefined && (!params.length || !requests.length)) {
         await bt[operation + "Characteristic"](
            this.getId(),
            request.serviceUuid,
            request.characteristicUuid,
            request.obj);
      }
      
      params.length && requests.push(request);
   }
   
   _innerListener(listener, data) {
      if (data.id.valueOf() == this.getId()) {
         if (listener.eventType == bt.events.connectionState.CONNECTED) {
            this.connected = true;
         } else if (listener.eventType == bt.events.connectionState.DISCONNECTED) {
            this.connected = false;
         }
         
         listener.listener(data);
      }
   }
}
