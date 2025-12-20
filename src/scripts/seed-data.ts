/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🌱 TEST DATA SEEDER - Populate MongoDB with Sample Data
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Run this script to seed the database with test customers and orders.
 * 
 * Usage: npx ts-node src/scripts/seed-data.ts
 */

import mongoose from 'mongoose'
import { Customer } from '../models/Customer'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/agentic-support'

const sampleCustomers = [
  {
    customerId: 'CUST-001',
    name: 'John Doe',
    email: 'john.doe@email.com',
    phone: '+1-555-0101',
    address: {
      street: '123 Main Street',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA',
    },
    orders: [
      {
        orderId: 'ORD-001-A',
        productName: 'MacBook Pro 16"',
        quantity: 1,
        price: 2499.99,
        orderDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        shipmentStatus: 'delayed',
        trackingNumber: 'TRK-FDX-123456',
        carrier: 'FedEx',
        estimatedDelivery: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago (overdue)
        issue: {
          type: 'weather_delay',
          description: 'Package delayed due to severe weather in transit hub',
          reportedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          isResolved: false,
        },
      },
      {
        orderId: 'ORD-001-B',
        productName: 'Apple AirPods Pro',
        quantity: 1,
        price: 249.99,
        orderDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        shipmentStatus: 'delivered',
        trackingNumber: 'TRK-UPS-789012',
        carrier: 'UPS',
        actualDelivery: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        issue: { type: 'none', isResolved: true },
      },
    ],
  },
  {
    customerId: 'CUST-002',
    name: 'Jane Smith',
    email: 'jane.smith@email.com',
    phone: '+1-555-0102',
    address: {
      street: '456 Oak Avenue',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90001',
      country: 'USA',
    },
    orders: [
      {
        orderId: 'ORD-002-A',
        productName: 'Sony PlayStation 5',
        quantity: 1,
        price: 499.99,
        orderDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        shipmentStatus: 'pending',
        issue: {
          type: 'payment_failed',
          description: 'Card declined - insufficient funds',
          reportedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          isResolved: false,
        },
      },
    ],
  },
  {
    customerId: 'CUST-003',
    name: 'Robert Johnson',
    email: 'robert.j@email.com',
    phone: '+1-555-0103',
    address: {
      street: '789 Pine Road',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60601',
      country: 'USA',
    },
    orders: [
      {
        orderId: 'ORD-003-A',
        productName: 'Samsung 65" OLED TV',
        quantity: 1,
        price: 1799.99,
        orderDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        shipmentStatus: 'in_transit',
        trackingNumber: 'TRK-USPS-345678',
        carrier: 'USPS',
        estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        issue: { type: 'none', isResolved: true },
      },
      {
        orderId: 'ORD-003-B',
        productName: 'HDMI Cable Pack',
        quantity: 3,
        price: 29.99,
        orderDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        shipmentStatus: 'out_for_delivery',
        trackingNumber: 'TRK-USPS-345679',
        carrier: 'USPS',
        estimatedDelivery: new Date(),
        issue: { type: 'none', isResolved: true },
      },
    ],
  },
  {
    customerId: 'CUST-004',
    name: 'Emily Davis',
    email: 'emily.davis@email.com',
    phone: '+1-555-0104',
    address: {
      street: '321 Maple Lane',
      city: 'Houston',
      state: 'TX',
      zipCode: '77001',
      country: 'USA',
    },
    orders: [
      {
        orderId: 'ORD-004-A',
        productName: 'Canon EOS R5',
        quantity: 1,
        price: 3899.99,
        orderDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        shipmentStatus: 'delayed',
        trackingNumber: 'TRK-DHL-567890',
        carrier: 'DHL',
        estimatedDelivery: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        issue: {
          type: 'customs_hold',
          description: 'Package held at customs for inspection',
          reportedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
          isResolved: false,
        },
      },
    ],
  },
  {
    customerId: 'CUST-005',
    name: 'Michael Brown',
    email: 'michael.brown@email.com',
    phone: '+1-555-0105',
    address: {
      street: '555 Cedar Boulevard',
      city: 'Seattle',
      state: 'WA',
      zipCode: '98101',
      country: 'USA',
    },
    orders: [
      {
        orderId: 'ORD-005-A',
        productName: 'Gaming Chair Pro',
        quantity: 1,
        price: 399.99,
        orderDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        shipmentStatus: 'processing',
        issue: { type: 'none', isResolved: true },
      },
      {
        orderId: 'ORD-005-B',
        productName: 'Mechanical Keyboard',
        quantity: 1,
        price: 149.99,
        orderDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        shipmentStatus: 'pending',
        issue: {
          type: 'payment_failed',
          description: 'Transaction declined - card expired',
          reportedAt: new Date(),
          isResolved: false,
        },
      },
    ],
  },
]

async function seedDatabase() {
  console.log('🌱 Starting database seeding...\n')

  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI)
    console.log('✅ Connected to MongoDB\n')

    // Clear existing data
    await Customer.deleteMany({})
    console.log('🗑️  Cleared existing customer data\n')

    // Insert sample customers
    for (const customerData of sampleCustomers) {
      const customer = new Customer(customerData)
      await customer.save()
      console.log(`✅ Created customer: ${customerData.name} (${customerData.customerId})`)
      console.log(`   📦 Orders: ${customerData.orders.length}`)
      
      const issues = customerData.orders.filter(o => o.issue.type !== 'none' && !o.issue.isResolved)
      if (issues.length > 0) {
        console.log(`   ⚠️  Active issues: ${issues.map(o => o.issue.type).join(', ')}`)
      }
      console.log('')
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎉 Database seeding completed!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')
    console.log('📊 Summary:')
    console.log(`   • Customers created: ${sampleCustomers.length}`)
    console.log(`   • Total orders: ${sampleCustomers.reduce((sum, c) => sum + c.orders.length, 0)}`)
    console.log('')
    console.log('🧪 Test queries:')
    console.log('   • "Where is my order?" (as john.doe@email.com)')
    console.log('   • "My payment failed" (as jane.smith@email.com)')
    console.log('   • "Track order ORD-003-A"')
    console.log('')

  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log('👋 Disconnected from MongoDB')
  }
}

// Run seeder
seedDatabase()

