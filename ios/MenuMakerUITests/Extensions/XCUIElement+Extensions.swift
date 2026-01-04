//
//  XCUIElement+Extensions.swift
//  MenuMakerUITests
//
//  Extensions for XCUIElement to help with testing
//

import XCTest

extension XCUIElement {
    /// Scrolls to make the element visible in its scroll view
    func scrollToElement() {
        guard !isHittable else { return }
        
        let startCoordinate = coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        let endCoordinate = startCoordinate.withOffset(CGVector(dx: 0, dy: -100))
        
        var attempts = 0
        while !isHittable && attempts < 10 {
            endCoordinate.press(forDuration: 0, thenDragTo: startCoordinate)
            attempts += 1
        }
    }

    /// Taps the element even when it is offscreen or not hittable by falling back to coordinate tapping.
    func forceTap(timeout: TimeInterval = 2) {
        if waitForExistence(timeout: timeout) {
            if isHittable {
                tap()
            } else {
                let center = coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
                center.tap()
            }
        }
    }
}
