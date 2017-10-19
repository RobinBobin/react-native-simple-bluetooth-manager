package ru.rshalimov.reactnative.simplebluetoothmanager;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.RCTNativeAppEventEmitter;

import android.util.Log;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothProfile;

import java.util.Map;
import java.util.HashMap;

class Module extends ReactContextBaseJavaModule {
   private final class BluetoothGattCallback
      extends android.bluetooth.BluetoothGattCallback
   {
      private final Map <Integer, String> eventNames = new HashMap <> ();
      
      BluetoothGattCallback() {
         eventNames.put(Integer.valueOf(BluetoothProfile.
            STATE_CONNECTED), Module.CONNECTION_STATE_CONNECTED);
         
         eventNames.put(Integer.valueOf(BluetoothProfile.
            STATE_CONNECTING), Module.CONNECTION_STATE_CONNECTING);
         
         eventNames.put(Integer.valueOf(BluetoothProfile.
            STATE_DISCONNECTED), Module.CONNECTION_STATE_DISCONNECTED);
         
         eventNames.put(Integer.valueOf(BluetoothProfile.
            STATE_DISCONNECTING), Module.CONNECTION_STATE_DISCONNECTING);
      }
      
      @Override
      public void onConnectionStateChange(
         BluetoothGatt gatt,
         int status,
         int newState)
      {
         super.onConnectionStateChange(gatt, status, newState);
         
         final String address = gatt.getDevice().getAddress();
         
         Log.d(Module.TAG, String.format(
            "onConnectionStateChange('%s', status=%d, newState=%d)",
               address, status, newState));
         
         final String eventName = eventNames.get(newState);
         
         if (eventName != null) {
            final WritableMap params = Arguments.createMap();
            
            params.putBoolean("error", status != BluetoothGatt.GATT_SUCCESS);
            params.putString("id", address);
            params.putInt("status", status);
            
            emit(eventName, params);
         }
      }
   }
   
   static final String TAG = "SimpleBluetoothManager";
   static final String E_UNSPECIFIED = "E_UNSPECIFIED";
   
   static final String CONNECTION_STATE_CONNECTED;
   static final String CONNECTION_STATE_CONNECTING;
   static final String CONNECTION_STATE_DISCONNECTED;
   static final String CONNECTION_STATE_DISCONNECTING;
   
   private final BluetoothGattCallback
      bluetoothGattCallback = new BluetoothGattCallback();
   
   private final Map <String, GattCache> gattCache = new HashMap <> ();
   
   static {
      CONNECTION_STATE_CONNECTED = TAG + "CONNECTION_STATE_CONNECTED";
      CONNECTION_STATE_CONNECTING = TAG + "CONNECTION_STATE_CONNECTING";
      CONNECTION_STATE_DISCONNECTED = TAG + "CONNECTION_STATE_DISCONNECTED";
      CONNECTION_STATE_DISCONNECTING = TAG + "CONNECTION_STATE_DISCONNECTING";
   }
   
   Module(ReactApplicationContext reactContext) {
      super(reactContext);
   }
   
   @Override
   public String getName() {
      return TAG;
   }
   
   @Override
   public Map <String, Object> getConstants() {
      final Map <String, Object> constants = new HashMap <> ();
      
      constants.put("CONNECTION_STATE_CONNECTED", CONNECTION_STATE_CONNECTED);
      constants.put("CONNECTION_STATE_CONNECTING", CONNECTION_STATE_CONNECTING);
      constants.put("CONNECTION_STATE_DISCONNECTED", CONNECTION_STATE_DISCONNECTED);
      
      constants.put("CONNECTION_STATE_DISCONNECTING",
         CONNECTION_STATE_DISCONNECTING);
      
      return constants;
   }
   
   @ReactMethod
   public void checkBluetoothAddress(String address, Promise promise) {
      final String addr = address.toUpperCase();
      
      if (BluetoothAdapter.checkBluetoothAddress(addr)) {
         promise.resolve(null);
      } else {
         promise.reject(E_UNSPECIFIED, String.format(
            "Invalid device id: '%s'", addr));
      }
   }
   
   @ReactMethod
   public void connectGatt(String address, Boolean autoConnect, Callback error) {
      Log.d(TAG, String.format("connectGatt(%s, %s)", address, autoConnect));
      
      final String addr = address.toUpperCase();
      
      if (!BluetoothAdapter.checkBluetoothAddress(addr)) {
         error.invoke(String.format("Invalid device id: '%s'", addr));
      } else if (!gattCache.containsKey(addr)) {
         gattCache.put(addr, new GattCache(BluetoothAdapter.getDefaultAdapter().
            getRemoteDevice(addr).connectGatt(getReactApplicationContext(),
               autoConnect, bluetoothGattCallback)));
      }
   }
   
   @ReactMethod
   public void closeGatt(String address, Callback error) {
      Log.d(TAG, String.format("closeGatt(%s)", address));
      
      try {
         final GattCache gatt = getGattCache(address, String.
            format("GATT for '%s' hasn't been connected.", address));
         
         gatt.gatt.close();
         
         if (gattCache.remove(address.toUpperCase()) == null) {
            throw new IllegalStateException(String.format(
               "gattCache.remove('%s') == null", address.toUpperCase()));
         }
      } catch (IllegalStateException e) {
         error.invoke(e.getMessage());
      }
   }
   
   private GattCache getGattCache(String address, String errorMessage) {
      final GattCache gatt = gattCache.get(address.toUpperCase());
      
      if (gatt == null) {
         throw new IllegalStateException(errorMessage);
      }
      
      return gatt;
   }
   
   private void emit(String eventName, WritableMap params) {
      getReactApplicationContext()
         .getJSModule(RCTNativeAppEventEmitter.class)
         .emit(eventName, params);
   }
}
