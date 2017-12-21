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

@objc(SimpleBluetoothManager) class SimpleBluetoothManager:
  RCTEventEmitter,
  CBCentralManagerDelegate
{
  var manager: CBCentralManager?;
  var peripherals: Set <CBPeripheral> = [];
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
    var emit: Bool?;
    
    for scanFilter in scanFilters {
      if scanFilter.deviceName != nil {
        emit = didDiscover.name == scanFilter.deviceName;
      }
      
      if emit ?? false {
        break;
      }
    }
    
    if emit ?? true {
      peripherals.insert(didDiscover);
      
      var bytes: [Int8]? = advertisementDataUnsigned ? nil : [];
      var ubytes: [UInt8]? = advertisementDataUnsigned ? [] : nil;
      
      let data: Data? = advertisementData[CBAdvertisementDataManufacturerDataKey] as? Data;
      
      if (data != nil) {
        if (bytes == nil) {
          for uint8 in data! {
            ubytes!.append(uint8);
          }
        } else {
          for uint8 in data! {
            bytes!.append(uint8 < 128 ? Int8(uint8) : Int8(Int16(uint8) - 256));
          }
        }
      }
      
      self.emit(eventName: SCAN_RESULT, params: [
        "results": [[
          "device": [
            "id": didDiscover.identifier.uuidString,
            "name": didDiscover.name
          ],
          "rssi": rssi,
          "scanRecord": [
            "bytes": bytes ?? ubytes as Any,
            "name": advertisementData[CBAdvertisementDataLocalNameKey]
          ]
      ]]]);
    }
  }
  
  func emit(eventName: String, params: [String: Any]) {
    var body: [String: Any] = ["eventName": eventName];
    
    params.forEach { param in body[param.key] = param.value };
    
    sendEvent(withName: eventName, body: body);
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
  
  @objc func isValid(_ address: String, resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) -> Void {
    resolver(nil);
  }

  @objc func isEnabled(_ resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) -> Void {
    resolver(manager!.state == CBManagerState.poweredOn);
  }
  
  @objc func startScan(
    _ options: [String: Any],
    resolver: RCTPromiseResolveBlock,
    rejecter: RCTPromiseRejectBlock) -> Void
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
      
      manager?.scanForPeripherals(withServices: nil, options: nativeOptions);
      
      resolver(nil);
    }
  }
  
  @objc func stopScan(_ resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) -> Void {
    manager!.stopScan();
    
    resolver(nil);
  }
  
  @objc func connectGatt(
    _ address: String,
    autoConnect: Bool,
    resolver: RCTPromiseResolveBlock,
    rejecter: RCTPromiseRejectBlock) -> Void
  {
    rejecter("", "can't connect yet", nil);
  }
  
  @objc func discoverServices(
    _ address: String,
    useCache: Bool,
    resolver: RCTPromiseResolveBlock,
    rejecter: RCTPromiseRejectBlock) -> Void
  {
    rejecter("", "can't discover yet", nil);
  }
  
  @objc func readCharacteristic(
    _ address: String,
    serviceUuid: String,
    characteristicUuid: String,
    options: [String: Any],
    resolver: RCTPromiseResolveBlock,
    rejecter: RCTPromiseRejectBlock)
  {
    rejecter("", "can't read yet", nil);
  }
  
  @objc func writeCharacteristic(
    _ address: String,
    serviceUuid: String,
    characteristicUuid: String,
    dataAndOptions: [String: Any],
    resolver: RCTPromiseResolveBlock,
    rejecter: RCTPromiseRejectBlock)
  {
    rejecter("", "can't write yet", nil);
  }
  
  @objc func closeGatt(
    _ address: String,
    resolver: RCTPromiseResolveBlock,
    rejecter: RCTPromiseRejectBlock)
  {
    rejecter("", "can't close yet", nil);
  }
}
