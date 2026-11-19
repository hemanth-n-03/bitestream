import { Outlet } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import CartDrawer from '../components/customer/CartDrawer';
import Modal from '../components/common/Modal';
import LocationPickerMap from '../components/maps/LocationPickerMap';
import { useLocationContext } from '../context/LocationContext';
import { useToast } from '../context/ToastContext';

export default function CustomerLayout() {
  const { selectedZone, setCustomCoordinates, isLocationModalOpen, closeLocationModal } =
    useLocationContext();
  const { toast } = useToast();

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <Navbar />
      <CartDrawer />

      <Modal
        isOpen={isLocationModalOpen}
        onClose={closeLocationModal}
        title="Pin Delivery Location (Mysuru)"
        maxWidth="max-w-2xl"
      >
        <LocationPickerMap
          coordinates={selectedZone.coordinates}
          pinLabel={selectedZone.label}
          onChangeCoordinates={(coords, label, address) => {
            setCustomCoordinates(coords, label, address);
          }}
        />
        <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
          <p className="text-xs text-slate-500">
            Active: <span className="font-semibold text-slate-800">{selectedZone.label}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              closeLocationModal();
              toast.success(`Delivery pin set to ${selectedZone.label}`);
            }}
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600"
          >
            Confirm Location
          </button>
        </div>
      </Modal>

      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
