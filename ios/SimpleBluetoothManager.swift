//
//  SimpleBluetoothManager.swift
//  SimpleBluetoothManager
//
//  Created by Robin Shalimov on 22/11/2017.
//  Copyright © 2017 Facebook. All rights reserved.
//

import Foundation;
import CoreBluetooth;

let CONNECTED = "CONNECTED";
let CONNECTING = "CONNECTING";
let DISCONNECTED = "DISCONNECTED";
let DISCONNECTING = "DISCONNECTING";
let SERVICES_DISCOVERED = "SERVICES_DISCOVERED";
let CHARACTERISTIC_READ = "CHARACTERISTIC_READ";
let CHARACTERISTIC_WRITTEN = "CHARACTERISTIC_WRITTEN";
let CHARACTERISTIC_CHANGED = "CHARACTERISTIC_CHANGED";
let DESCRIPTOR_READ = "DESCRIPTOR_READ";
let DESCRIPTOR_WRITTEN = "DESCRIPTOR_WRITTEN";
let SCAN_FAILED = "SCAN_FAILED";
let SCAN_RESULT = "SCAN_RESULT";

struct ScanFilter {
   var deviceName: String?;
}

class CBPeripheralData {
   let peripheral: CBPeripheral;
   private var autoConnect: Bool?;
   private var serviceIndex = -1;
   private var characteristicIndex = -1;
   
   init(_ peripheral: CBPeripheral) {
      self.peripheral = peripheral;
   }
   
   func setAutoConnect(_ autoConnect: Bool) {
      self.autoConnect = autoConnect;
   }
   
   func isAutoConnect() -> Bool {
      return autoConnect!;
   }
   
   func discoverCharacteristics() -> Bool {
      serviceIndex += 1;
      
      let hasNext = serviceIndex < peripheral.services!.count;
      
      if hasNext {
         peripheral.discoverCharacteristics(nil, for: peripheral.services![serviceIndex]);
         
         characteristicIndex = -1;
      }
      
      return hasNext;
   }
   
   func discoverDescriptors() -> Bool {
      characteristicIndex += 1;
      
      let hasNext = characteristicIndex < peripheral.services![serviceIndex].characteristics!.count;
      
      if hasNext {
         peripheral.discoverDescriptors(for: peripheral.services![serviceIndex].characteristics![characteristicIndex]);
      }
      
      return hasNext;
   }
   
   func resetDiscovered() {
      serviceIndex = -1;
      characteristicIndex = -1;
   }
   
   func isDiscovered() -> Bool {
      return peripheral.services?.count == serviceIndex && peripheral.services![serviceIndex - 1].characteristics?.count == characteristicIndex && peripheral.services![serviceIndex - 1].characteristics![characteristicIndex - 1].descriptors != nil;
   }
}

enum Errors : Error {
   case unknownDevice(uuid: String)
   case servicesNotDiscovered(uuid: String)
   case invalidServiceUuid(peripheralUuid: String, serviceUuid: String)
   case invalidCharacteristicUuid(peripheralUuid: String, serviceUuid: String, characteristicUuid: String)
   case invalidDescriptorUuid(peripheralUuid: String, serviceUuid: String, characteristicUuid: String, descriptorUuid: String)
}

@objc(SimpleBluetoothManager) class SimpleBluetoothManager:
   RCTEventEmitter,
   CBCentralManagerDelegate,
   CBPeripheralDelegate
{
   var manager: CBCentralManager?;
   var peripherals = [String: CBPeripheralData]();
   var scanFilters = [ScanFilter]();
   var advertisementDataUnsigned = true;
   var readOptions = [String: [String: Any]]();
   
   override init() {
      super.init();
      
      manager = CBCentralManager(delegate: self, queue: nil);
   }
   
   override func supportedEvents() -> [String] {
      return [
         CONNECTED,
         CONNECTING,
         DISCONNECTED,
         DISCONNECTING,
         SERVICES_DISCOVERED,
         CHARACTERISTIC_READ,
         CHARACTERISTIC_WRITTEN,
         CHARACTERISTIC_CHANGED,
         DESCRIPTOR_READ,
         DESCRIPTOR_WRITTEN,
         SCAN_FAILED,
         SCAN_RESULT
      ];
   }
   
   func centralManagerDidUpdateState(_ central: CBCentralManager) {
      NSLog("%@", "BT state updated to: \(central.state.rawValue).");
      
      if central.state.rawValue < CBManagerState.poweredOff.rawValue {
         peripherals.removeAll();
      }
   }
   
   func centralManager(
      _ central: CBCentralManager,
      didDiscover: CBPeripheral,
      advertisementData: [String: Any],
      rssi: NSNumber)
   {
      let localName = advertisementData[CBAdvertisementDataLocalNameKey] as? String;
      
      var emit: Bool?;
      
      for scanFilter in scanFilters {
         if scanFilter.deviceName != nil {
            emit = didDiscover.name == scanFilter.deviceName || localName == scanFilter.deviceName;
         }
         
         if emit ?? false {
            break;
         }
      }
      
      if emit ?? true {
         peripherals[didDiscover.identifier.uuidString] = CBPeripheralData(didDiscover);
         
         let data: Data? = advertisementData[CBAdvertisementDataManufacturerDataKey] as? Data;
         let ubytes: [UInt8] = data == nil ? [UInt8]() : [UInt8](data!);
         
         self.emit(SCAN_RESULT, [
            "results": [[
               "device": [
                  "id": didDiscover.identifier.uuidString,
                  "name": didDiscover.name
               ],
               "rssi": rssi,
               "scanRecord": [
                  "bytes": (advertisementDataUnsigned ? ubytes : ubytes.map {Int8(bitPattern: $0)}) as Any,
                  "name": localName!
               ]
               ]]]);
      }
   }
   
   func centralManager(_ central: CBCentralManager, didConnect: CBPeripheral) {
      didConnect.delegate = self;
      
      emitConnectedDisconnected(
         connected: true,
         peripheral: didConnect,
         error: nil);
   }
   
   func centralManager(_ central: CBCentralManager, didFailToConnect: CBPeripheral, error: Error?) {
      emitConnectedDisconnected(
         connected: true,
         peripheral: didFailToConnect,
         error: error);
   }
   
   func centralManager(_ central: CBCentralManager, didDisconnectPeripheral: CBPeripheral, error: Error?) {
      emitConnectedDisconnected(
         connected: false,
         peripheral: didDisconnectPeripheral,
         error: error);
      
      let nsError = error as NSError?;
      
      if nsError?.domain == CBErrorDomain && nsError?.code == CBError.Code.connectionTimeout.rawValue {
         do {
            let peripheralData = try getPeripheralData(didDisconnectPeripheral.identifier.uuidString);
            
            if peripheralData.isAutoConnect() {
               manager!.connect(peripheralData.peripheral);
            }
         } catch {
            NSLog("%@", String(describing: error));
         }
      }
   }
   
   func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
      onReadWrittenChanged(peripheral, characteristic, false, error);
   }
   
   func peripheral(_ peripheral: CBPeripheral, didWriteValueFor descriptor: CBDescriptor, error: Error?) {
      onReadWrittenChanged(peripheral, descriptor, false, error);
   }
   
   func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
      if error != nil {
         emitServices(peripheral: peripheral, error: error);
      } else {
         _ = try! getPeripheralData(peripheral.identifier.uuidString).discoverCharacteristics();
      }
   }
   
   func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
      if error != nil {
         emitServices(peripheral: peripheral, error: error);
      } else {
         _ = try! getPeripheralData(peripheral.identifier.uuidString).discoverDescriptors();
      }
   }
   
   func peripheral(_ peripheral: CBPeripheral, didDiscoverDescriptorsFor characteristic: CBCharacteristic, error: Error?) {
      var emit = error != nil;
      
      if !emit {
         let peripheralData = try! getPeripheralData(peripheral.identifier.uuidString);
         
         emit = !(peripheralData.discoverDescriptors() || peripheralData.discoverCharacteristics());
      }
      
      if emit {
         emitServices(peripheral: peripheral, error: error);
      }
   }
   
   func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
      if error != nil {
         NSLog("%@", "Characteristic notification state failed to be updated (\(String(describing: error))).");
      }
   }
   
   func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
      onReadWrittenChanged(peripheral, characteristic, true, error);
   }
   
   func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor descriptor: CBDescriptor, error: Error?) {
      onReadWrittenChanged(peripheral, descriptor, true, error);
   }
   
   func emit(_ eventName: String, _ params: [String: Any]) {
      var body: [String: Any] = ["eventName": eventName];
      
      params.forEach { param in body[param.key] = param.value };
      
      sendEvent(withName: eventName, body: body);
   }
   
   func putCommonGattParams(_ peripheral: CBPeripheral, _ error: Error?) -> [String: Any] {
      return [
         "id": peripheral.identifier.uuidString,
         "status": (error as NSError?)?.localizedDescription ?? "",
         "error": error != nil
      ];
   }
   
   func emitConnectedDisconnected(connected: Bool, peripheral: CBPeripheral, error: Error?) {
      emit(connected ? CONNECTED : DISCONNECTED, putCommonGattParams(peripheral, error));
   }
   
   func emitServices(peripheral: CBPeripheral, error: Error?) {
      var services = [[String: Any]]();
      
      if error == nil {
         for service in peripheral.services! {
            var chars = [[String: Any]]();
            
            for ch in service.characteristics! {
               chars.append([
                  "uuid": ch.uuid.uuidString,
                  "instanceId": ch.uuid.uuidString,
                  //c.putInt("permissions", ch.getPermissions());
                  //c.putInt("properties", ch.getProperties());
                  //c.putInt("writeType", ch.getWriteType());]);
                  ]);
            }
            
            services.append([
               "uuid": service.uuid.uuidString,
               "instanceId": service.uuid.uuidString,
               "characteristics": chars]);
         }
      }
      
      var params = putCommonGattParams(peripheral, error);
      
      params["services"] = services;
      
      emit(SERVICES_DISCOVERED, params);
   }
   
   func getPeripheralData(_ uuid: String) throws -> CBPeripheralData {
      let peripheralData = peripherals[uuid];
      
      if peripheralData == nil {
         throw Errors.unknownDevice(uuid: uuid);
      }
      
      return peripheralData!;
   }
   
   func findCBAttribute <T: CBAttribute> (_ array: [T], _ uuid: String, _ error: Error) throws -> T {
      var element: T?;
      
      for e in array {
         if e.uuid.uuidString.caseInsensitiveCompare(uuid) == ComparisonResult.orderedSame {
            element = e;
            break;
         }
      }
      
      if element == nil {
         throw error;
      }
      
      return element!;
   }
   
   func getCharacteristic(
      _ peripheral: CBPeripheral,
      _ serviceUuid: String,
      _ characteristicUuid: String) throws -> CBCharacteristic
   {
      return try findCBAttribute(
         try findCBAttribute(
            peripheral.services!,
            serviceUuid,
            Errors.invalidServiceUuid(peripheralUuid: peripheral.identifier.uuidString, serviceUuid: serviceUuid)).characteristics!,
         characteristicUuid,
         Errors.invalidCharacteristicUuid(peripheralUuid: peripheral.identifier.uuidString, serviceUuid: serviceUuid, characteristicUuid: characteristicUuid));
   }
   
   func getDescriptor(
      _ peripheral: CBPeripheral,
      _ serviceUuid: String,
      _ characteristicUuid: String,
      _ descriptorUuid: String) throws -> CBDescriptor
   {
      return try findCBAttribute(
         getCharacteristic(peripheral, serviceUuid, characteristicUuid).descriptors!,
         descriptorUuid,
         Errors.invalidDescriptorUuid(peripheralUuid: peripheral.identifier.uuidString, serviceUuid: serviceUuid, characteristicUuid: characteristicUuid, descriptorUuid: descriptorUuid));
   }
   
   func getReadOptionsKey(_ parts: String?...) -> String {
      var key = "";
      
      for part in parts {
         if part != nil {
            key += part!;
         }
      }
      
      return key;
   }
   
   func onReadWrittenChanged(
      _ peripheral: CBPeripheral,
      _ characteristicOrDescriptor: CBAttribute,
      _ read: Bool,
      _ error: Error?)
   {
      let isCh = characteristicOrDescriptor is CBCharacteristic;
      let descriptor: CBDescriptor? = isCh ? nil : (characteristicOrDescriptor as! CBDescriptor);
      let characteristic = isCh ? characteristicOrDescriptor as! CBCharacteristic : descriptor!.characteristic;
      
      let serviceUuid = characteristic.service.uuid.uuidString;
      let characteristicUuid = characteristic.uuid.uuidString;
      let descriptorUuid: String? = isCh ? nil : descriptor!.uuid.uuidString;
      
      var params = putCommonGattParams(peripheral, error);
      
      params["serviceUuid"] = serviceUuid;
      params["characteristicUuid"] = characteristicUuid;
      params["descriptorUuid"] = descriptorUuid;
      
      // TODO read descriptor
      if read && isCh {
         let options = readOptions[getReadOptionsKey(peripheral.identifier.uuidString, serviceUuid, characteristicUuid, descriptorUuid)];
         
         let value = [UInt8](characteristic.value!);
         
         params["value"] = options != nil && options!["valueUnsigned"] as! Bool ? value : value.map {Int8(bitPattern: $0)};
      }
      
      emit(isCh ? (read ? (characteristic.isNotifying ? CHARACTERISTIC_CHANGED : CHARACTERISTIC_READ) : CHARACTERISTIC_WRITTEN) : (read ? DESCRIPTOR_READ : DESCRIPTOR_WRITTEN), params);
   }
   
   @objc override func constantsToExport() -> [AnyHashable: Any] {
      var events = [String: [String: String]]();
      
      [
         "connectionState": [
            CONNECTED,
            CONNECTING,
            DISCONNECTED,
            DISCONNECTING
         ],
         "gatt": [
            SERVICES_DISCOVERED,
            CHARACTERISTIC_READ,
            CHARACTERISTIC_WRITTEN,
            CHARACTERISTIC_CHANGED,
            DESCRIPTOR_READ,
            DESCRIPTOR_WRITTEN
         ],
         "leScanCallback": [
            SCAN_FAILED,
            SCAN_RESULT
         ]
         ].forEach { category in events[category.key] = category.value.reduce([:], {
            result, element in var result = result; result![element] = element; return result;
         }) };
      
      return [
         "events": events,
         "scanMode": [
            "LOW_POWER": -1,
            "BALANCED": -1,
            "LOW_LATENCY": -1
         ]];
   }
   
   @objc func isValid(_ uuid: String, resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
      resolver(nil);
   }
   
   @objc func isEnabled(_ resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
      resolver(manager!.state == CBManagerState.poweredOn);
   }
   
   @objc func startScan(
      _ options: [String: Any],
      resolver: RCTPromiseResolveBlock,
      rejecter: RCTPromiseRejectBlock)
   {
      if manager!.state != CBManagerState.poweredOn {
         rejecter("", "Bluetooth is not on", nil);
      } else {
         peripherals.removeAll();
         scanFilters.removeAll();
         
         advertisementDataUnsigned = options["advertisementDataUnsigned"] as? Bool ?? true;
         
         for filter in ((options["filters"] as? [[String: Any]]) ?? []) {
            var scanFilter = ScanFilter();
            
            scanFilter.deviceName = filter["deviceName"] as? String;
            
            scanFilters.append(scanFilter);
         }
         
         var nativeOptions = [String: Any]();
         
         if let allowDuplicates = options["allowDuplicates"] as? Bool {
            nativeOptions[CBCentralManagerScanOptionAllowDuplicatesKey] = allowDuplicates;
         }
         
         manager!.scanForPeripherals(withServices: nil, options: nativeOptions);
         
         resolver(nil);
      }
   }
   
   @objc func stopScan(_ resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
      manager!.stopScan();
      
      resolver(nil);
   }
   
   @objc func connectGatt(
      _ uuid: String,
      autoConnect: Bool,
      resolver: RCTPromiseResolveBlock,
      rejecter: RCTPromiseRejectBlock)
   {
      do {
         let peripheralData = try getPeripheralData(uuid);
         
         if peripheralData.peripheral.state == CBPeripheralState.disconnected
            || peripheralData.peripheral.state == CBPeripheralState.disconnecting
         {
            peripheralData.setAutoConnect(autoConnect);
            
            manager!.connect(peripheralData.peripheral);
            
            resolver(nil);
         }
      } catch {
         rejecter("", String(describing: error), error);
      }
   }
   
   @objc func isKnownDeviceId(
      _ uuid: String,
      resolver: RCTPromiseResolveBlock,
      rejecter: RCTPromiseRejectBlock)
   {
      let ar = manager!.retrievePeripherals(withIdentifiers: [UUID(uuidString: uuid)!]);
      
      resolver(ar.count == 1);
   }
   
   @objc func discoverServices(
      _ uuid: String,
      useCache: Bool,
      resolver: RCTPromiseResolveBlock,
      rejecter: RCTPromiseRejectBlock)
   {
      do {
         let peripheralData = try getPeripheralData(uuid);
         
         if useCache && peripheralData.isDiscovered() {
            emitServices(peripheral: peripheralData.peripheral, error: nil);
         } else {
            peripheralData.resetDiscovered();
            peripheralData.peripheral.discoverServices(nil);
            
            resolver(nil);
         }
      } catch {
         rejecter("", String(describing: error), error);
      }
   }
   
   @objc func readCharacteristic(
      _ peripheralUuid: String,
      serviceUuid: String,
      characteristicUuid: String,
      options: [String: Any],
      resolver: RCTPromiseResolveBlock,
      rejecter: RCTPromiseRejectBlock)
   {
      rejecter("", "can't read yet", nil);
   }
   
   @objc func writeCharacteristic(
      _ peripheralUuid: String,
      serviceUuid: String,
      characteristicUuid: String,
      dataAndOptions: [String: Any],
      resolver: RCTPromiseResolveBlock,
      rejecter: RCTPromiseRejectBlock)
   {
      do {
         let peripheral = try getPeripheralData(peripheralUuid).peripheral;
         
         peripheral.writeValue(Data((dataAndOptions["value"] as! [Int8]).map {UInt8(bitPattern: $0)}), for: try getCharacteristic(peripheral, serviceUuid, characteristicUuid), type: CBCharacteristicWriteType.withResponse)
         
         resolver(nil);
      } catch {
         rejecter("", String(describing: error), error);
      }
   }
   
   @objc func setCharacteristicNotification(
      _ peripheralUuid: String,
      serviceUuid: String,
      characteristicUuid: String,
      enable: Bool,
      options: [String: Any],
      resolver: RCTPromiseResolveBlock,
      rejecter: RCTPromiseRejectBlock)
   {
      do {
         let peripheral = try getPeripheralData(peripheralUuid).peripheral;
         let characteristic = try getCharacteristic(peripheral, serviceUuid, characteristicUuid);
         
         peripheral.setNotifyValue(enable, for: characteristic);
         
         readOptions[getReadOptionsKey(peripheralUuid, serviceUuid, characteristicUuid)] = enable ? options : nil;
         
         resolver(nil);
      } catch {
         rejecter("", String(describing: error), error);
      }
   }
   
   @objc func writeDescriptor(
      _ peripheralUuid: String,
      serviceUuid: String,
      characteristicUuid: String,
      descriptorUuid: String,
      dataAndOptions: [String: Any],
      resolver: RCTPromiseResolveBlock,
      rejecter: RCTPromiseRejectBlock)
   {
      rejecter("", "can't writeDescriptor yet", nil);
   }
   
   @objc func closeGatt(
      _ uuid: String,
      resolver: RCTPromiseResolveBlock,
      rejecter: RCTPromiseRejectBlock)
   {
      do {
         manager!.cancelPeripheralConnection(try getPeripheralData(uuid).peripheral);
         
         resolver(nil);
      } catch {
         rejecter("", String(describing: error), error);
      }
   }
}
