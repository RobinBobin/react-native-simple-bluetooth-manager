import { NativeModules } from "react-native";
import {
  EventHandlingHelper,
  StaticUtils
} from "react-native-common-utils";

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
    
    this.setConnectionOptions({});
  }
  
  areServicesDiscovered() {
    return !!this._servicesDiscovered;
  }
  
  async closeGatt() {
    this._throwIfShutdownRequested();
    
    await this._closeGatt();
  }
  
  async connect() {
    this._throwIfShutdownRequested();
    
    return await bt.connect(this.getId());
  }
  
  async connectGatt() {
    this._throwIfShutdownRequested();
    
    console.log(`BluetoothDevice.connectGatt('${this.getId()
        }', ${JSON.stringify(this._connectionOptions)}).`);
    
    await bt.connectGatt(this.getId(), this._connectionOptions.autoConnect);
  }
  
  async disconnect() {
    this._throwIfShutdownRequested();
    
    await this._disconnect();
  }
  
  async discoverServices(useCache = true) {
    this._throwIfShutdownRequested();
    
    await bt.discoverServices(this.getId(), useCache);
  }
  
  flushRequests(read) {
    if (read || !arguments.length) {
      this._requests.read.length = 0;
    }
    
    if (!read || !arguments.length) {
      this._requests.write.length = 0;
    }
  }
  
  getId() {
    return this._id;
  }
  
  isConnected() {
    return !!this._connected;
  }
  
  isShutdownRequested() {
    return !!this._shutdownRequested;
  }
  
  isValid() {
    return bt.isValid(this.getId());
  }
  
  async openConnection() {
    await this.connectGatt();
    
    return this._connectionOptions.invokeBTGattConnect && StaticUtils.isAndroid() ? await this.connect() : undefined;
  }
  
  async readCharacteristic(serviceUuid, characteristicUuid, options) {
    this._throwIfShutdownRequested();
    
    await this._safeReadWrite(true, [serviceUuid, characteristicUuid, options]);
  }
  
  async readDescriptor(
    serviceUuid,
    characteristicUuid,
    descriptorUuid,
    options)
  {
    this._throwIfShutdownRequested();
    
    await this._safeReadWrite(true, [serviceUuid, characteristicUuid, descriptorUuid, options]);
  }
  
  async readSerialNumber() {
    await this.readCharacteristic(
      StaticUtils.isAndroid() ? "0000180A-0000-1000-8000-00805F9B34FB" : "180A",
      StaticUtils.isAndroid() ? "00002A25-0000-1000-8000-00805F9B34FB" : "2A25", {
        asString: true
      }
    );
  }
  
  async setCharacteristicNotification(
    serviceUuid,
    characteristicUuid,
    enable,
    options)
  {
    this._throwIfShutdownRequested();
    
    if (!enable) {
      const position = this._notifiedCharacteristics[serviceUuid].indexOf(characteristicUuid);
      
      if (position !== -1) {
        this._notifiedCharacteristics[serviceUuid].splice(position, 1);
        
        if (!this._notifiedCharacteristics[serviceUuid].length) {
          delete this._notifiedCharacteristics[serviceUuid];
        }
      }
    }
    
    await this._setCharacteristicNotification(serviceUuid, characteristicUuid, enable, options);
    
    if (enable) {
      if (!this._notifiedCharacteristics[serviceUuid]) {
        this._notifiedCharacteristics[serviceUuid] = [];
      }
      
      this._notifiedCharacteristics[serviceUuid].push(characteristicUuid);
    }
  }
  
  setConnectionOptions({
    autoConnect = false,
    autoDiscoverServices = true,
    autoDiscoverServicesUseCache = true,
    invokeBTGattConnect = true,
    invokeBTGattDisconnect = true
  }) {
    this._connectionOptions = {
      autoConnect,
      autoDiscoverServices,
      autoDiscoverServicesUseCache,
      invokeBTGattConnect,
      invokeBTGattDisconnect
    };
  }
  
  setFailureHandler(failureHandler) {
    this._failureHandler = failureHandler;
    
    return this;
  }
  
  setReadWriteTimeoutHandler(readWriteTimeoutHandler) {
    this._readWriteTimeoutHandler = readWriteTimeoutHandler;
    
    return this;
  }
  
  setShutdownTimeout(shutdownTimeout) {
    this._shutdownTimeout = shutdownTimeout;
    
    return this;
  }
  
  async shutdown() {
    this._throwIfShutdownRequested();
    
    this._shutdownRequested = true;
    
    this._eventHandlingHelper.removeListeners();
    
    if (!this.isConnected()) {
      console.log(`Shutting down a disconnected BluetoothDevice connection with '${this.getId()}'.`);
      
      this._eventHandlingHelper.removeInnerListeners();
      
      try {
        if (this._connectionOptions.invokeBTGattDisconnect && StaticUtils.isAndroid()) {
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
      
      if (this._requests.read.length || this._requests.write.length) {
        await new Promise(resolve => setTimeout(resolve, this._shutdownTimeout));
      }
      
      console.log(`Shutting down a BluetoothDevice connection with '${this.getId()}'. R/W requests pending: ${this._requests.read.length + this._requests.write.length}.`);
      
      try {
        if (StaticUtils.isIOS()) {
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
    
    if (dataAndOptions.chunkSize == undefined
      || !Array.isArray(dataAndOptions.value)
      || dataAndOptions.value.length <= dataAndOptions.chunkSize)
    {
      await this._safeReadWrite(false, args, timeout);
    } else {
      if (dataAndOptions.chunkSize <= 0) {
        throw new Error(`dataAndOptions.chunkSize (${dataAndOptions.chunkSize}) can't be <= 0`);
      }
      
      const value = dataAndOptions.value;
      
      while (value.length) {
        args[2].value = value.splice(0, dataAndOptions.chunkSize);
        
        await this._safeReadWrite(false, args, timeout, !value.length);
      }
    }
  }
  
  async writeDescriptor(
    serviceUuid,
    characteristicUuid,
    descriptorUuid,
    dataAndOptions)
  {
    this._throwIfShutdownRequested();
    
    await this._safeReadWrite(false, [serviceUuid, characteristicUuid, descriptorUuid, dataAndOptions]);
  }
  
  async _closeGatt() {
    await bt.closeGatt(this.getId());
  }
  
  async _disconnect() {
    await bt.disconnect(this.getId());
  }
  
  async _innerListener(data) {
    if (data.id.valueOf() !== this.getId()) {
      return;
    }
    
    let rwCompleted;
    
    try {
      switch (data.eventName) {
        case bt.events.connectionState.CONNECTED:
          console.log(`BluetoothDevice connected (${this.getId()})${this._withError(data)}.`);
          
          this._connected = !data.error;
          
          if (this.isConnected() && this._connectionOptions.autoDiscoverServices) {
            await this.discoverServices(this._connectionOptions.autoDiscoverServicesUseCache);
          }
          
          break;
        
        case bt.events.connectionState.DISCONNECTED:
          console.log(`BluetoothDevice disconnected (${this.getId()})${this._withError(data)}.`);
          
          this._connected = false;
          this._servicesDiscovered = false;
          
          this.flushRequests();
          
          if (this.isShutdownRequested()) {
            this._eventHandlingHelper.removeInnerListeners();
            
            if (StaticUtils.isAndroid()) {
              await this._closeGatt();
            }
          }
          
          break;
        
        case bt.events.gatt.SERVICES_DISCOVERED:
          console.log(`BluetoothDevice services discovered (${this.getId()})${this._withError(data)}.`);
          
          this._servicesDiscovered = !data.error;
          
          break;
        
        case bt.events.gatt.CHARACTERISTIC_READ:
        case bt.events.gatt.DESCRIPTOR_READ:
          rwCompleted = await this._safeReadWrite(true);
          break;
        
        case bt.events.gatt.CHARACTERISTIC_WRITTEN:
        case bt.events.gatt.DESCRIPTOR_WRITTEN:
          rwCompleted = await this._safeReadWrite(false);
          break;
      }
    } catch (e) {
        this._failureHandler(e);
    }
    
    const args = [data];
    
    if (rwCompleted != undefined) {
      args.push(rwCompleted);
    }
    
    this._eventHandlingHelper.invokeListeners(...args);
  }
  
  async _safeReadWrite(read, params = [], timeout, lastChunk = true) {
    const operation = read ? "read" : "write";
    const requests = this._requests[operation];
    
    let request;
    let rwCompleted;
    
    if (!params.length) {
      rwCompleted = requests.shift().lastChunk;
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
        timeout,
        lastChunk
      };
      
      if (params.length === 4) {
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
      
      await bt[operation + (descrOp ? "Descriptor" : "Characteristic")].apply(null, ar);
      
      if (request.timeout > 0) {
        this._safeReadWriteTimeoutId = setTimeout(() => {
          if (this._readWriteTimeoutHandler) {
            this._readWriteTimeoutHandler();
          }
        }, request.timeout);
      }
    }
    
    params.length && requests.push(request);
    
    return rwCompleted;
  }
  
  async _setCharacteristicNotification(
    serviceUuid,
    characteristicUuid,
    enable,
    options)
  {
    await bt.setCharacteristicNotification(this.getId(), serviceUuid, characteristicUuid, enable, options);
    
    if (StaticUtils.isAndroid()) {
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
  
  _withError(data) {
    return data.error ? ` with error ${data.status}` : "";
  }
}
