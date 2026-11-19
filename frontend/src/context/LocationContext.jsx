import { createContext, useContext, useState } from 'react';
import { MYSURU_ZONES } from '../utils/geo';

const LocationContext = createContext(null);

export function LocationProvider({ children }) {
  const [selectedZone, setSelectedZone] = useState(MYSURU_ZONES[0]);
  const [customLandmark, setCustomLandmark] = useState('Near 5th Main Temple Road');
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([
    {
      id: 'addr-1',
      label: 'Home',
      zoneId: 'gokulam',
      street: '42, 5th Main, Gokulam 3rd Stage, Mysuru',
      coordinates: MYSURU_ZONES[0].coordinates,
    },
    {
      id: 'addr-2',
      label: 'Campus / Work',
      zoneId: 'saraswathipuram',
      street: 'JSS Layout Block B, Saraswathipuram, Mysuru',
      coordinates: MYSURU_ZONES[2].coordinates,
    },
  ]);

  const selectZoneById = (zoneId) => {
    const found = MYSURU_ZONES.find((z) => z.id === zoneId);
    if (found) setSelectedZone(found);
  };

  const setCustomCoordinates = (coordinates, label = 'Custom Map Pin', address) => {
    const [lng, lat] = coordinates;
    setSelectedZone({
      id: 'custom-pin',
      label,
      address: address || `Pinned GeoJSON [${lng.toFixed(4)}, ${lat.toFixed(4)}], Mysuru`,
      coordinates: [Number(lng.toFixed(6)), Number(lat.toFixed(6))],
    });
  };

  const addSavedAddress = ({ label, zoneId, street, coordinates }) => {
    const zone = MYSURU_ZONES.find((z) => z.id === zoneId) || MYSURU_ZONES[0];
    const resolvedCoords = coordinates || zone.coordinates;
    const next = {
      id: `addr-${Date.now()}`,
      label,
      zoneId: coordinates ? 'custom-pin' : zone.id,
      street,
      coordinates: resolvedCoords,
    };
    setSavedAddresses((prev) => [next, ...prev]);
    setSelectedZone({
      id: next.zoneId,
      label,
      address: street,
      coordinates: resolvedCoords,
    });
  };

  return (
    <LocationContext.Provider
      value={{
        selectedZone,
        selectZoneById,
        setCustomCoordinates,
        customLandmark,
        setCustomLandmark,
        savedAddresses,
        addSavedAddress,
        isLocationModalOpen,
        openLocationModal: () => setIsLocationModalOpen(true),
        closeLocationModal: () => setIsLocationModalOpen(false),
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationContext() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationContext must be used within LocationProvider');
  return ctx;
}
