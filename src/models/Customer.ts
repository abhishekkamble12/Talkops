import mongoose, { Schema, Document } from 'mongoose'

// Issue types for customer orders
export type IssueType =
  | 'payment_failed'
  | 'weather_delay'
  | 'customs_hold'
  | 'address_issue'
  | 'out_of_stock'
  | 'carrier_delay'
  | 'damaged_in_transit'
  | 'returned_to_sender'
  | 'none'

// Shipment status types
export type ShipmentStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'delayed'
  | 'cancelled'
  | 'returned'

export interface ICustomer extends Document {
  customerId: string
  name: string
  email: string
  phone: string
  address: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  orders: {
    orderId: string
    productName: string
    quantity: number
    price: number
    orderDate: Date
    shipmentStatus: ShipmentStatus
    trackingNumber?: string
    estimatedDelivery?: Date
    actualDelivery?: Date
    carrier?: string
    issue: {
      type: IssueType
      description?: string
      reportedAt?: Date
      resolvedAt?: Date
      isResolved: boolean
    }
  }[]
  createdAt: Date
  updatedAt: Date
}

const CustomerSchema = new Schema<ICustomer>(
  {
    customerId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
    },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    orders: [
      {
        orderId: { type: String, required: true },
        productName: { type: String, required: true },
        quantity: { type: Number, required: true, default: 1 },
        price: { type: Number, required: true },
        orderDate: { type: Date, required: true, default: Date.now },
        shipmentStatus: {
          type: String,
          enum: [
            'pending',
            'processing',
            'shipped',
            'in_transit',
            'out_for_delivery',
            'delivered',
            'delayed',
            'cancelled',
            'returned',
          ],
          default: 'pending',
        },
        trackingNumber: { type: String },
        estimatedDelivery: { type: Date },
        actualDelivery: { type: Date },
        carrier: { type: String },
        issue: {
          type: {
            type: String,
            enum: [
              'payment_failed',
              'weather_delay',
              'customs_hold',
              'address_issue',
              'out_of_stock',
              'carrier_delay',
              'damaged_in_transit',
              'returned_to_sender',
              'none',
            ],
            default: 'none',
          },
          description: { type: String },
          reportedAt: { type: Date },
          resolvedAt: { type: Date },
          isResolved: { type: Boolean, default: false },
        },
      },
    ],
  },
  {
    timestamps: true,
  }
)

// Text index for searching
CustomerSchema.index({
  name: 'text',
  email: 'text',
  'orders.orderId': 'text',
  'orders.productName': 'text',
  'orders.trackingNumber': 'text',
})

export const Customer = mongoose.models.Customer || mongoose.model<ICustomer>('Customer', CustomerSchema)

