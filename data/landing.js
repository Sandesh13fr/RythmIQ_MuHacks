import {
    BarChart3,
    Receipt,
    PieChart,
    CreditCard,
    Globe,
    Zap,
    Shield,
    Bot,
    MessageCircle,
  } from "lucide-react";
  
  // Stats Data
  export const statsData = [
    {
      value: "50K",
      label: "Active Users",
    },
    {
      value: "1K",
      label: "Transactions Tracked",
    },
    {
      value: "99.9%",
      label: "Uptime",
    },
    {
      value: "4.9/5",
      label: "User Rating",
    },
  ];
  
  // Features Data
  export const featuresData = [
    {
      icon: <BarChart3 className="h-8 w-8 text-purple-600" />,
      title: "AI-Powered Expense Tracking",
      description:
        "Leverage real-time AI analytics to categorize and optimize your spending efficiently.",
    },
    {
      icon: <Receipt className="h-8 w-8 text-purple-600" />,
      title: "Instant Receipt Parsing",
      description:
        "Snap a picture—our AI extracts and logs key details instantly for seamless expense management.",
    },
    {
      icon: <PieChart className="h-8 w-8 text-purple-600" />,
      title: "Dynamic Budgeting Assistant",
      description:
        "Get real-time budget insights with adaptive recommendations based on your financial behavior.",
    },
    {
      icon: <CreditCard className="h-8 w-8 text-purple-600" />,
      title: "Unified Multi-Account Hub",
      description:
        "Seamlessly sync and track multiple bank accounts and credit cards in one dashboard.",
    },
    {
      icon: <Globe className="h-8 w-8 text-purple-600" />,
      title: "Global Currency Support",
      description:
        "Real-time currency conversion and insights for seamless international transactions.",
    },
    {
      icon: <Zap className="h-8 w-8 text-purple-600" />,
      title: "AI-Driven Financial Alerts",
      description:
        "Automated notifications for unusual transactions, budget deviations, and saving opportunities.",
    },
  ];
  
  // How It Works Data
  export const howItWorksData = [
    {
      icon: <Bot className="h-8 w-8 text-blue-600" />,
      title: "1. Sense & Forecast",
      description:
        "Predictive agents watch every transaction, forecast cash flow, and spot shortfalls days in advance.",
    },
    {
      icon: <Shield className="h-8 w-8 text-blue-600" />,
      title: "2. Decide & Guard",
      description:
        "Shortfall Guardian, Spending Guardrails, and Goal Backstops choose the safest move for your accounts.",
    },
    {
      icon: <Zap className="h-8 w-8 text-blue-600" />,
      title: "3. Act Automatically",
      description:
        "Micro-save transfers, budget locks, and bill prep run on their own with daily/weekly caps you control.",
    },
    {
      icon: <MessageCircle className="h-8 w-8 text-blue-600" />,
      title: "4. Explain & Learn",
      description:
        "Digest emails and counterfactuals show every action, while feedback tunes the next set of nudges.",
    },
  ];
  
  // Testimonials Data
  export const testimonialsData = [
    {
      name: "Aakash Medge",
      role: "Small Business Owner",
      image: "https://randomuser.me/api/portraits/men/75.jpg",
      quote:
        "Moneymap helps me for tracking my small scale business",
    },
    {
      name: "Girish Patil",
      role: "Freelancer",
      image: "https://randomuser.me/api/portraits/men/75.jpg",
      quote:
        "I am using Moneymap for my money tracking in day to day life .",
    },
    {
      name: "Gayatri Patil",
      role: "Financial Advisor",
      image: "https://randomuser.me/api/portraits/women/74.jpg",
      quote:
        "Using Moneymap for my Makeup Shop to track customer transactions.",
    },

  ];