import mongoose from 'mongoose';

export function isValidLngLat(coords) {
  if (!Array.isArray(coords) || coords.length !== 2) return false;
  const [lng, lat] = coords;
  return (
    typeof lng === 'number' &&
    typeof lat === 'number' &&
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

const geoPointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: [true, 'GeoJSON coordinates [longitude, latitude] are required'],
      validate: {
        validator: isValidLngLat,
        message: 'Coordinates must be [longitude, latitude] within valid WGS84 bounds',
      },
    },
  },
  { _id: false }
);

export default geoPointSchema;
