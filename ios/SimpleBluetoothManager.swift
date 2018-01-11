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
}

@objc(SimpleBluetoothManager) class SimpleBluetoothManager:
   RCTEventEmitter,
   CBCentralManagerDelegate,
   CBPeripheralDelegate
{
   var manager: CBCentralManager?;
   var peripherals = [String: CBPeripheralData]();
   var scanFilters: [ScanFilter] = [];
   var advertisementDataUnsigned = true;
   
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
         SCAN_FAILED,
         SCAN_RESULT
      ];
   }
   
   func centralManagerDidUpdateState(_ central: CBCentralManager) {
      NSLog("%@", "BT state updated to: \(central.state.rawValue)");
      
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
         
         var bytes: [Int8]? = advertisementDataUnsigned ? nil : [];
         var ubytes: [UInt8]? = advertisementDataUnsigned ? [] : nil;
         
         let data: Data? = advertisementData[CBAdvertisementDataManufacturerDataKey] as? Data;
         
         if data != nil {
            if bytes == nil {
               for uint8 in data! {
                  ubytes!.append(uint8);
               }
            } else {
               for uint8 in data! {
                  bytes!.append(uint8 < 128 ? Int8(uint8) : Int8(Int16(uint8) - 256));
               }
            }
         }
         
         self.emit(SCAN_RESULT, [
            "results": [[
               "device": [
                  "id": didDiscover.identifier.uuidString,
                  "name": didDiscover.name
               ],
               "rssi": rssi,
               "scanRecord": [
                  "bytes": bytes ?? ubytes as Any,
                  "name": localName as Any
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
      var params = putCommonGattParams(peripheral, error);
      
      params["serviceUuid"] = characteristic.service.uuid.uuidString;
      params["characteristicUuid"] = characteristic.uuid.uuidString;
      
      emit(CHARACTERISTIC_WRITTEN, params);
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
   
   func getCharacteristic(_ peripheral: CBPeripheral, _ serviceUuid: String, _ characteristicUuid: String) throws -> CBCharacteristic {
      func find <T: CBAttribute> (_ array: [T], _ uuid: String, _ error: Error) throws -> T {
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
      
      return try find(
         try find(
            peripheral.services!,
            serviceUuid,
            Errors.invalidServiceUuid(peripheralUuid: peripheral.identifier.uuidString, serviceUuid: serviceUuid)).characteristics!,
         characteristicUuid,
         Errors.invalidCharacteristicUuid(peripheralUuid: peripheral.identifier.uuidString, serviceUuid: serviceUuid, characteristicUuid: characteristicUuid));
   }
   
   @objc override func constantsToExport() -> [String: Any] {
      var events: [String: [String: String]] = [:];
      
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
            CHARACTERISTIC_WRITTEN
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
         let value = dataAndOptions["value"] as! Array <Int>;
         
         var data = [UInt8]();
         data.reserveCapacity(value.count);
         
         for byte in value {
            data.append(UInt8(byte >= 0 ? byte : byte + 256));
         }
         
         peripheral.writeValue(Data(data), for: try getCharacteristic(peripheral, serviceUuid, characteristicUuid), type: CBCharacteristicWriteType.withResponse)
         
         resolver(nil);
      } catch {
         rejecter("", String(describing: error), error);
      }
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
