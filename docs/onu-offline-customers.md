# ONU Offline Customers

The existing home dashboard opens the `OnuOfflineCustomers` native-stack route (`src/screens/OnuOfflineCustomersScreen.tsx`). The module reuses Redux, the Gigatel header/theme, safe-area handling, and react-native-maps. Customer details use a modal bottom sheet, shared by list and map actions.

## Live data and session

`src/services/onuOfflineSignalR.ts` owns one session-level connection, mounted by RootNavigator. It observes MMKV session changes, Redux dashboard employee details, AppState and NetInfo. User ID comes from LOGIN_RESPONSE; organization ID comes from that response or the matching user's dashboard employee details. Company ID comes exclusively from companyId in the AppLogin loginUserInfo stored as LOGIN_RESPONSE. The selected-company preference cannot override the hub scope. Missing scope is displayed as an error; employee IDs and example IDs are never substituted.

The development hub is `http://mob.gigatel.me:7006/isp_signalR_dev/switchshub`, with all three required query parameters: userId, companyId and organizationId. The current session token is supplied by accessTokenFactory. The exact event is `OnuOfflineCustomersUpdate`. SignalR internal logs remain disabled. Development builds log sanitized HTTP request URLs, response status/timing and negotiation metadata, connection lifecycle and event counts through src/services/onuOfflineDiagnostics.ts. Authorization headers, connection tokens and customer fields are excluded; production builds emit none of these logs. View them in the React Native DevTools console (press j in Metro), then reload to capture negotiation. Each screen focus also logs [ONU SignalR] Screen opened with the current connection status, last event timestamp, known offline count and waiting state. This focus log does not open another connection or invent an HTTP response. React Native 0.77 does not forward JavaScript console logs into the Metro terminal. Automatic reconnect is supplemented by bounded initial-start retry delays. App backgrounding and loss of connectivity stop the connection; foreground/network recovery create a fresh connection after the previous one stops. Logout clears records and removes listeners. Screen unmount does not disconnect the dashboard's session connection.

Production intentionally requires an explicitly configured HTTPS ONU hub URL; the development host is not guessed to be a production host. Update ONU_HUB_URL before enabling this module with API_ENVIRONMENT=PROD.

## Event contract and count

No offline snapshot API or snapshot/delta contract was found in the repository. Events are merged, scoped by OrganizationId:ServerId:CustomerId. Omitted customers remain in memory, including across temporary disconnections. Only explicit IsOnline/Status changes remove a customer from the offline list and markers. Contradictory or unknown statuses are ignored; partial fields preserve previous values. Online records remain available to an already-open details sheet. Counts are labeled **known offline**, rather than claiming a complete authoritative total. Replayed events are idempotent by scoped key; absent sequence/version metadata, arrival order governs conflicting changes.

No snapshot request or unsupported hub method is invented. Both views show a loading indicator until the first valid customer event arrives, including when SignalR is already connected. There is no timeout that hides loading prematurely. A valid empty Customers array ends initial loading and shows the empty state. Previously received customers stay visible during reconnection and between backend updates. The screen offers connection retry when disconnected; it cannot request an authoritative refresh while connected. Reconnection gaps cannot be reconciled until a documented snapshot endpoint or replay/snapshot hub contract is supplied. Empty events do not clear existing customers. State is in memory only, and is cleared on session changes/logout.

## List, map and details

FlatList uses src/features/onuOffline/CustomerListCard.tsx for customer cards with initials, name/ID hierarchy, offline badge, contact rows, a separate device-information panel, last-inform time and distinct Details/Map actions. Values wrap within the card; unavailable locations disable the map action. The list header shows the filtered count and sort order. It searches name, ID, mobile and MAC; records sort by valid last-inform timestamps, newest first. Both views and the details sheet read the same Redux state. Dates display in the device's local timezone, with the UTC source value also available in full details.

Coordinates must contain two nonempty finite numbers within geographic bounds. Missing/invalid locations stay in the list and are counted separately on the map. Offline customers use a white head-and-shoulders silhouette drawn with native views in a red circular marker with a white border, centered on the actual coordinates. The silhouette renders synchronously with the marker, avoiding asynchronous image loading in native map snapshots. Large datasets (150+ located records) use a zoom-dependent grid grouping without another map library; tapping a group zooms and provides a customer picker, including colocated customers. Marker selections expose customer fields and full details. View on Map focuses actual coordinates. Initial fitting, explicit Fit all and customer focus are the only camera changes; live updates do not interrupt exploration. Map region and selection survive tab switches.

## Native configuration

Android already allows cleartext HTTP and already has a Google Maps key; no Android network or key changes were required. iOS already has an ATS exception for mob.gigatel.me; no broader exception was added.

The Podfile adds react-native-maps/Google; pods were installed. AppDelegate initializes Google Maps using a GOOGLE_MAPS_API_KEY build setting override or the API_KEY in the existing bundled GoogleService-Info.plist. No key is copied into new source files. Enable Maps SDK for iOS and verify iOS bundle restrictions/billing for the chosen Google project/key; Firebase configuration alone does not prove Maps SDK authorization. CocoaPods reconciled the previously stale lockfile with versions already present in node_modules, including maps 1.29.0.

Dependencies added: @microsoft/signalr 8.x and react-native-url-polyfill 2.x (the latter supplies URL/URLSearchParams needed by SignalR negotiation on RN 0.77).

## Validation

- Android `./gradlew :app:assembleDebug`: passed.
- Full Android production JavaScript bundle: passed, using a temporary Metro config with resolver.useWatchman=false because the machine's Watchman root scans the home directory.
- Focused Jest suites: payload/scope validation, coordinates, partial records, duplicate replays, explicit online transitions, search/sorting, clustering, initial retry, session/logout/network lifecycle, screen search/details, marker focus and preservation of map exploration.
- ESLint on new module/tests: passed.
- Repository TypeScript check: fails on pre-existing errors elsewhere; no diagnostics in the new ONU module/tests.
- CocoaPods installation: passed.
- iOS simulator build with Xcode 26.5: blocked by existing fmt 11.0.2 C++ consteval errors in format-inl.h, before a full app build could complete. iOS runtime compatibility is not claimed.
- Connected Android device: dashboard card, navigation and rendered Google Map verified; SignalR reached Connected with the existing authenticated session. No customer update event was received.
- Live backend events and populated live customer markers must be verified with an authorized session and an actual OnuOfflineCustomersUpdate event. Synthetic fixtures are confined to tests.

## Files

Created: src/features/onuOffline/CustomerListCard.tsx, src/services/onuOfflineDiagnostics.ts, __tests__/onuOfflineDiagnostics.test.ts, src/features/onuOffline/model.ts, src/features/onuOffline/mapMarkers.ts, src/store/slices/onuOffline.slice.ts, src/services/onuOfflineSignalR.ts, src/screens/OnuOfflineCustomersScreen.tsx, __tests__/onuOffline.test.ts, __tests__/onuOfflineSignalR.test.ts, __tests__/onuOfflineScreen.test.tsx, and this document.

Modified: package.json, src/store/reducers.ts, src/utils/preferences.ts, src/navigations/navigator.tsx, src/screens/home/home-dashboard.tsx, src/screens/home/index.tsx, ios/Podfile, ios/Podfile.lock, ios/GTPL/AppDelegate.swift and ios/GTPL/Info.plist.


## Connection diagnosis (2 November 2026)

The public negotiation endpoint returned HTTP 200 and advertised WebSockets, ServerSentEvents and LongPolling. A computer-side SignalR handshake succeeded, and the physical Android app also logged HTTP 200 followed by Connected for user 12 / organization 1. No customer-update event was observed during this check.

Captured cancellation: "The connection was stopped during negotiation." Background, network and session cleanup can intentionally cancel an in-flight start; those cancellations now log the stop reason and are excluded from Connection failed. Genuine failures now include sanitized errorMessage and statusCode when supplied by SignalR, including reconnect/close diagnostics. Previous logs that only contained errorType cannot establish the cause of every historical failure.

## Missing customer-data diagnosis (3 November 2026)

The connected phone's current user was 16, organization 1, login/dashboard company 24. Its selected-company preference was 0. Fixed the ONU service to validate the selected-company preference before falling back to the positive login company ID; previously the zero placeholder masked company 24. Confirmed the phone subsequently negotiated HTTP 200 and connected with companyId=24. A regression test covers this case.

The app state showed lastUpdateReceivedAt=null, no error and zero stored records. In a 35-second diagnostic observation with company 24, the hub emitted OnuDevicesUpdate with OrganizationId, ServerId and Devices. A further 35-second observation confirmed a device record with GenieAcsDeviceId, IsOnline, Status, LastInformUtc, SerialNumber, ProductClass, ManufacturerOUI, Manufacturer, HardwareVersion, SoftwareVersion, ModelName, ExternalIPAddress, MACAddress, Tags, OpticalSignals, WifiNetworks, LanHosts and WifiAssociatedDevices. No customer names, mobile numbers, customer IDs, addresses or map coordinates were present. Only schema/metadata were inspected; device/customer values were not logged.

No OnuOfflineCustomersUpdate was observed in those windows. A device inventory event is not a customer snapshot and does not establish whether there are zero offline customers. No customer IDs or locations were inferred from device IDs, tags or IP addresses. Populating the requested module requires the backend's OnuOfflineCustomersUpdate/Customers contract, a current-customer snapshot API, or a documented device-to-customer lookup and any required subscription method. The service's Swagger JSON route tested at /isp_signalR_dev/swagger/v1/swagger.json returned 404, so it supplied no contract.

Six SignalR service tests passed, including the company-zero fallback; ESLint and diff checks passed. The temporary Metro diagnostic server was stopped after the investigation.

## Angular connection contract supplied by the user

The working Angular flow constructs switchshub?userId=...&companyId=...&organizationId=... and registers OnuOfflineCustomersUpdate with connection.on. No server-side invoke/join method appears in the supplied snippet. The mobile flow now requires a positive company ID as well as user/organization scope, uses the same query shape, and waits for session scope instead of opening a partially scoped connection. Per the user-confirmed backend contract, the login company is used regardless of the stored selection; an unavailable login company blocks connection until session data supplies it.

The event handler is registered before start. Development diagnostics now log Listener registered, Event received before validation, and a validation reason when a received payload cannot be accepted. No full payload/customer fields are logged. Unit tests cover listener registration order, missing-company recovery and receipt/validation logging. The user confirmed Angular's environment.signalRUrl as http://mob.gigatel.me:7006/isp_signalR_dev/ and AppLogin as the companyId source. This matches the mobile development endpoint. A populated customer-event payload still has not been verified.
