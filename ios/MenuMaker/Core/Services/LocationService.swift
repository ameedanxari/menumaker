import Foundation
import CoreLocation
import Combine

/// Location service for managing location updates
@MainActor
class LocationService: NSObject, ObservableObject {
    static let shared = LocationService()

    @Published var currentLocation: CLLocation?
    @Published var authorizationStatus: CLAuthorizationStatus = .notDetermined
    @Published var locationError: Error?

    private let locationManager = CLLocationManager()
    private var continuations: [CheckedContinuation<CLLocation, Error>] = []

    override private init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = 100 // Update every 100 meters
        authorizationStatus = locationManager.authorizationStatus
    }

    // MARK: - Public Methods

    func requestAuthorization() {
        locationManager.requestWhenInUseAuthorization()
    }

    func startUpdatingLocation() {
        guard authorizationStatus == .authorizedWhenInUse || authorizationStatus == .authorizedAlways else {
            requestAuthorization()
            return
        }

        locationManager.startUpdatingLocation()
    }

    func stopUpdatingLocation() {
        locationManager.stopUpdatingLocation()
    }

    func getCurrentLocation() async throws -> CLLocation {
        return try await withCheckedThrowingContinuation { continuation in
            if let location = currentLocation {
                continuation.resume(returning: location)
                return
            }

            continuations.append(continuation)
            startUpdatingLocation()
        }
    }

    func getCoordinates() -> (latitude: Double, longitude: Double)? {
        guard let location = currentLocation else { return nil }
        return (location.coordinate.latitude, location.coordinate.longitude)
    }

    // MARK: - Distance Calculation

    func distance(from location: CLLocation) -> CLLocationDistance? {
        currentLocation?.distance(from: location)
    }

    func distanceString(from location: CLLocation) -> String? {
        guard let distance = distance(from: location) else { return nil }

        if distance < 1000 {
            return String(format: "%.0f m", distance)
        } else {
            return String(format: "%.1f km", distance / 1000)
        }
    }

    // MARK: - Geocoding

    func reverseGeocode(location: CLLocation) async throws -> CLPlacemark? {
        let geocoder = CLGeocoder()
        let placemarks = try await geocoder.reverseGeocodeLocation(location)
        return placemarks.first
    }

    func geocode(address: String) async throws -> CLLocation? {
        let geocoder = CLGeocoder()
        let placemarks = try await geocoder.geocodeAddressString(address)
        return placemarks.first?.location
    }
}

// MARK: - CLLocationManagerDelegate

extension LocationService: CLLocationManagerDelegate {
    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        Task { @MainActor in
            guard let location = locations.last else { return }

            currentLocation = location

            // Resume any waiting continuations
            for continuation in continuations {
                continuation.resume(returning: location)
            }
            continuations.removeAll()
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            locationError = error

            // Resume any waiting continuations with error
            for continuation in continuations {
                continuation.resume(throwing: error)
            }
            continuations.removeAll()
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            authorizationStatus = manager.authorizationStatus

            if authorizationStatus == .authorizedWhenInUse || authorizationStatus == .authorizedAlways {
                startUpdatingLocation()
            }
        }
    }
}
