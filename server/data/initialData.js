/**
 * Initial Seed Data for Smart Campus Micro-Payments and Ordering Ecosystem
 * Domain-based roles: @std (Student), @shop (Merchant), @admin (Admin)
 */

const initialData = {
  users: [
    // STUDENTS (@std)
    {
      id: "stu_101",
      role: "STUDENT",
      domain: "std",
      allowedPortals: ["student"],
      name: "Aarav Sharma",
      email: "aarav.sharma@std",
      password: "campus123",
      rollNo: "2024CS1042",
      department: "Computer Science & Engineering",
      semester: "4th Semester",
      avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
      phone: "+91 98765 43210",
      parentId: "par_201",
      wallet: {
        balance: 650.00,
        currency: "INR",
        dailySpendLimit: 300.00,
        todaySpent: 45.00,
        lastRechargeAt: new Date(Date.now() - 86400000).toISOString()
      },
      card: {
        cardUid: "NFC-8A7F-B21C",
        barcodeNumber: "8901234567890",
        issuedAt: "2024-08-01",
        expiresAt: "2028-06-30",
        status: "ACTIVE",
        secretKey: "k_sec_aarav_9942718291a"
      }
    },
    {
      id: "stu_102",
      role: "STUDENT",
      domain: "std",
      allowedPortals: ["student"],
      name: "Ananya Patel",
      email: "ananya.patel@std",
      password: "campus123",
      rollNo: "2024EC2015",
      department: "Electronics & Communication",
      semester: "4th Semester",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
      phone: "+91 98111 22334",
      parentId: "par_202",
      wallet: {
        balance: 1240.00,
        currency: "INR",
        dailySpendLimit: 500.00,
        todaySpent: 120.00,
        lastRechargeAt: new Date(Date.now() - 43200000).toISOString()
      },
      card: {
        cardUid: "NFC-3C99-F41A",
        barcodeNumber: "8909876543210",
        issuedAt: "2024-08-01",
        expiresAt: "2028-06-30",
        status: "ACTIVE",
        secretKey: "k_sec_ananya_3381920391b"
      }
    },
    {
      id: "stu_103",
      role: "STUDENT",
      domain: "std",
      allowedPortals: ["student"],
      name: "Rahul Verma",
      email: "rahul.verma@std",
      password: "campus123",
      rollNo: "2023ME3048",
      department: "Mechanical Engineering",
      semester: "6th Semester",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      phone: "+91 97222 33445",
      parentId: null,
      wallet: {
        balance: 32.50,
        currency: "INR",
        dailySpendLimit: 250.00,
        todaySpent: 0.00,
        lastRechargeAt: new Date(Date.now() - 172800000).toISOString()
      },
      card: {
        cardUid: "NFC-7D1E-669B",
        barcodeNumber: "8905551234567",
        issuedAt: "2023-08-01",
        expiresAt: "2027-06-30",
        status: "ACTIVE",
        secretKey: "k_sec_rahul_7718293019c"
      }
    },

    // MERCHANTS (@shop)
    {
      id: "mer_canteen",
      role: "MERCHANT",
      domain: "shop",
      allowedPortals: ["pos", "kitchen"],
      name: "Chef Raman (Cafeteria)",
      email: "canteen@shop",
      password: "campus123",
      vendorId: "ven_canteen",
      vendorName: "Central Campus Cafeteria",
      avatar: "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=150&auto=format&fit=crop&q=80",
      phone: "+91 98888 11111"
    },
    {
      id: "mer_greenleaf",
      role: "MERCHANT",
      domain: "shop",
      allowedPortals: ["pos", "kitchen"],
      name: "Green Leaf Counter",
      email: "greenleaf@shop",
      password: "campus123",
      vendorId: "ven_greenleaf",
      vendorName: "Green Leaf Juice & Healthy Cafe",
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
      phone: "+91 98888 22222"
    },
    {
      id: "mer_printshop",
      role: "MERCHANT",
      domain: "shop",
      allowedPortals: ["pos", "kitchen"],
      name: "Campus Print Hub Staff",
      email: "printshop@shop",
      password: "campus123",
      vendorId: "ven_printshop",
      vendorName: "Campus Print & Stationery Hub",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      phone: "+91 98888 33333"
    },

    // ADMINS (@admin)
    {
      id: "adm_001",
      role: "ADMIN",
      domain: "admin",
      allowedPortals: ["admin", "split"],
      name: "Prof. K. Sundaram (Dean)",
      email: "dean.sundaram@admin",
      password: "campus123",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
      phone: "+91 94444 55555"
    }
  ],

  vendors: [
    {
      id: "ven_canteen",
      name: "Central Campus Cafeteria",
      shortName: "Central Canteen",
      category: "Food & Canteen",
      tagline: "Fresh hot meals, quick bites, and regional specials",
      counterLocation: "Food Court, Block C - Ground Floor",
      posTerminalId: "POS-TERM-CANTEEN-01",
      rating: 4.8,
      prepTimeEstimate: "8-12 mins",
      isOpen: true,
      bannerImage: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80",
      menu: [
        {
          id: "item_c1",
          name: "Masala Dosa with Sambar & Chutney",
          category: "South Indian Breakfast",
          price: 55.00,
          isVeg: true,
          isPopular: true,
          prepTime: "6 mins",
          image: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=300&auto=format&fit=crop&q=80",
          description: "Crispy fermented crepe filled with spiced potato masala, served with piping hot sambar and fresh coconut chutney."
        },
        {
          id: "item_c2",
          name: "Deluxe Student Mini Thali",
          category: "Lunch Combos",
          price: 90.00,
          isVeg: true,
          isPopular: true,
          prepTime: "8 mins",
          image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300&auto=format&fit=crop&q=80",
          description: "2 Rotis, Paneer butter masala, yellow dal tadka, steamed basmati rice, roasted papad and pickle."
        },
        {
          id: "item_c3",
          name: "Crispy Samosa (Set of 2)",
          category: "Quick Snacks",
          price: 30.00,
          isVeg: true,
          isPopular: true,
          prepTime: "2 mins",
          image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=300&auto=format&fit=crop&q=80",
          description: "Golden fried flaky pastry stuffed with savory cumin spiced potatoes and green peas. Served with tangy tamarind dip."
        },
        {
          id: "item_c4",
          name: "Filter Coffee / Masala Chai",
          category: "Hot Beverages",
          price: 20.00,
          isVeg: true,
          isPopular: false,
          prepTime: "2 mins",
          image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=300&auto=format&fit=crop&q=80",
          description: "Traditional aromatic strong filter brew or ginger-cardamom steeped milk chai."
        },
        {
          id: "item_c5",
          name: "Paneer Grilled Sandwich",
          category: "Quick Snacks",
          price: 65.00,
          isVeg: true,
          isPopular: true,
          prepTime: "7 mins",
          image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=300&auto=format&fit=crop&q=80",
          description: "Layered with marinated cottage cheese, bell peppers, mint mayo, and grilled golden brown with butter."
        },
        {
          id: "item_c6",
          name: "Hyderabadi Veg Dum Biryani",
          category: "Lunch Combos",
          price: 110.00,
          isVeg: true,
          isPopular: true,
          prepTime: "10 mins",
          image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300&auto=format&fit=crop&q=80",
          description: "Fragrant basmati rice slow-cooked with fresh garden veggies, saffron, and shahi spices. Served with cooling cucumber raita."
        }
      ]
    },
    {
      id: "ven_greenleaf",
      name: "Green Leaf Juice & Healthy Cafe",
      shortName: "Green Leaf Cafe",
      category: "Beverages & Healthy Bites",
      tagline: "Fresh fruit bowls, chilled smoothies, and energized snacks",
      counterLocation: "Sports Complex Pavilion - Counter 2",
      posTerminalId: "POS-TERM-GREENLEAF-02",
      rating: 4.9,
      prepTimeEstimate: "5-7 mins",
      isOpen: true,
      bannerImage: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80",
      menu: [
        {
          id: "item_g1",
          name: "Tropical Mango Passion Smoothie",
          category: "Smoothies & Shakes",
          price: 70.00,
          isVeg: true,
          isPopular: true,
          prepTime: "4 mins",
          image: "https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=300&auto=format&fit=crop&q=80",
          description: "Pure Alphonso mango pulp blended with Greek yogurt, passion fruit honey, and chia seeds."
        },
        {
          id: "item_g2",
          name: "Cold Pressed Pomegranate & Orange",
          category: "Fresh Juices",
          price: 60.00,
          isVeg: true,
          isPopular: false,
          prepTime: "3 mins",
          image: "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=300&auto=format&fit=crop&q=80",
          description: "100% natural, no added sugar, rich in antioxidants and vitamin C."
        },
        {
          id: "item_g3",
          name: "Avocado & Sprouts Protein Salad",
          category: "Healthy Bowls",
          price: 85.00,
          isVeg: true,
          isPopular: true,
          prepTime: "6 mins",
          image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300&auto=format&fit=crop&q=80",
          description: "Moong sprouts, diced avocado, pomegranate arils, toasted pumpkin seeds, tossed in zesty lemon vinaigrette."
        }
      ]
    },
    {
      id: "ven_printshop",
      name: "Campus Print & Stationery Hub",
      shortName: "Campus Print Hub",
      category: "Printing & Academic Stationery",
      tagline: "Fast laser printing, spiral thesis binding, and semester stationery",
      counterLocation: "Central Library Annex - Basement Level",
      posTerminalId: "POS-TERM-PRINTSHOP-03",
      rating: 4.7,
      prepTimeEstimate: "3-5 mins",
      isOpen: true,
      bannerImage: "https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=800&auto=format&fit=crop&q=80",
      menu: [
        {
          id: "item_p1",
          name: "A4 Document Printing (B&W)",
          category: "Print Services",
          price: 2.00,
          unit: "page",
          isVeg: false,
          isPopular: true,
          prepTime: "2 mins",
          image: "https://images.unsplash.com/photo-1562654501-a0ccc0fc3fb1?w=300&auto=format&fit=crop&q=80",
          description: "75 GSM crisp laser printout. Ideal for lecture notes, assignments, and exam hall tickets."
        },
        {
          id: "item_p2",
          name: "A4 Color Laser Printing",
          category: "Print Services",
          price: 10.00,
          unit: "page",
          isVeg: false,
          isPopular: true,
          prepTime: "3 mins",
          image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80",
          description: "High definition 1200 DPI color printing for project reports, diagrams, and charts."
        },
        {
          id: "item_p3",
          name: "Heavy Duty Spiral Binding",
          category: "Binding",
          price: 35.00,
          unit: "binding",
          isVeg: false,
          isPopular: true,
          prepTime: "5 mins",
          image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&auto=format&fit=crop&q=80",
          description: "Durable clear acetate front cover, stiff black backboard, and plastic spiral comb binding."
        },
        {
          id: "item_p4",
          name: "Classmate 160-Page Ruled Notebook",
          category: "Stationery",
          price: 60.00,
          unit: "piece",
          isVeg: false,
          isPopular: false,
          prepTime: "1 min",
          image: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=300&auto=format&fit=crop&q=80",
          description: "Single line ruled notebook with premium chlorine-free paper."
        }
      ]
    }
  ],

  transactions: [
    {
      id: "txn_init_001",
      studentId: "stu_101",
      studentName: "Aarav Sharma",
      rollNo: "2024CS1042",
      vendorId: "ven_canteen",
      vendorName: "Central Campus Cafeteria",
      amount: 45.00,
      type: "OFFLINE_MICROPAYMENT",
      method: "NFC_ID_TAP",
      status: "SUCCESS",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      posTerminalId: "POS-TERM-CANTEEN-01",
      authCryptogram: "AUTH-89A1-F4E2-8819",
      itemsSummary: "Filter Coffee x1, Crispy Samosa x1",
      note: "Offline ID tap verified by local POS terminal against central ledger."
    },
    {
      id: "txn_init_002",
      studentId: "stu_101",
      studentName: "Aarav Sharma",
      rollNo: "2024CS1042",
      vendorId: null,
      vendorName: "Online UPI Gateway (Sandbox)",
      amount: 500.00,
      type: "ONLINE_UPI_RECHARGE",
      method: "UPI_DYNAMIC_QR",
      status: "SUCCESS",
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      posTerminalId: null,
      authCryptogram: "UPI-TXN-REF-90218491",
      itemsSummary: "Wallet Top-up via GPay",
      note: "Parent/Student remote wallet recharge via UPI payment gateway."
    }
  ],

  orders: [
    {
      id: "ord_1001",
      orderNumber: "ORD-1001",
      studentId: "stu_101",
      studentName: "Aarav Sharma",
      studentRoll: "2024CS1042",
      studentPhone: "+91 98765 43210",
      vendorId: "ven_canteen",
      vendorName: "Central Campus Cafeteria",
      items: [
        { id: "item_c2", name: "Deluxe Student Mini Thali", qty: 1, price: 90.00 }
      ],
      totalAmount: 90.00,
      status: "PREPARING",
      pickupOtp: "4912",
      orderType: "PRE_ORDER_FOOD",
      createdAt: new Date(Date.now() - 360000).toISOString(),
      updatedAt: new Date(Date.now() - 180000).toISOString(),
      notes: "Extra spicy paneer masala please."
    }
  ],

  auditLogs: [
    {
      id: "audit_001",
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      actor: "stu_101 (Aarav Sharma)",
      action: "WALLET_RECHARGE_SUCCESS",
      details: "Recharged ₹500 via Online UPI Gateway (Ref: UPI-TXN-REF-90218491)",
      ipAddress: "10.14.20.89",
      severity: "INFO"
    },
    {
      id: "audit_002",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      actor: "POS-TERM-CANTEEN-01",
      action: "OFFLINE_CARD_MICROPAYMENT",
      details: "Authorized ₹45.00 deduction for Card NFC-8A7F-B21C (Student: 2024CS1042)",
      ipAddress: "192.168.4.10",
      severity: "INFO"
    }
  ]
};

module.exports = initialData;
