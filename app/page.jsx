import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, TrendingUp, Shield, Zap, Target, Award, CheckCircle } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-purple-100 px-4 py-2 rounded-full mb-6">
            <Sparkles className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-900">AI-Powered Financial Agent</span>
          </div>

          <h1 className="text-6xl font-bold text-gray-900 mb-6">
            Your Money,
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent"> Predicted</span>
          </h1>

          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            The world's first truly proactive financial assistant. RythmIQ predicts problems before they happen and takes action to prevent them.
          </p>

          <div className="flex gap-4 justify-center">
            <Link href="/sign-up">
              <Button size="lg" className="bg-black hover:bg-gray-800 text-white px-8">
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/demo">
              <Button size="lg" variant="outline" className="border-gray-300">
                Try Demo
              </Button>
            </Link>
          </div>

          <p className="text-sm text-gray-500 mt-4">
            No credit card required • 2 minute setup • Built for India
          </p>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-black text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-4xl font-bold">₹5,200</p>
              <p className="text-gray-400 mt-2">Avg. Monthly Savings</p>
            </div>
            <div>
              <p className="text-4xl font-bold">85%</p>
              <p className="text-gray-400 mt-2">Prediction Accuracy</p>
            </div>
            <div>
              <p className="text-4xl font-bold">2-3</p>
              <p className="text-gray-400 mt-2">Daily AI Suggestions</p>
            </div>
            <div>
              <p className="text-4xl font-bold">500M+</p>
              <p className="text-gray-400 mt-2">Potential Users in India</p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Not Just Tracking. <span className="text-purple-600">Preventing.</span>
          </h2>
          <p className="text-xl text-gray-600">
            Traditional apps react to problems. RythmIQ prevents them.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-white p-8 rounded-2xl border-2 border-gray-200 hover:border-purple-400 transition-all hover:shadow-lg">
            <div className="bg-purple-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Zap className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Proactive Nudges</h3>
            <p className="text-gray-600 mb-4">
              AI suggests actions BEFORE problems occur. Auto-save surplus, pay bills on time, avoid overdrafts.
            </p>
            <ul className="space-y-2">
              <li className="flex items-center text-sm text-gray-700">
                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                Auto-save suggestions
              </li>
              <li className="flex items-center text-sm text-gray-700">
                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                Bill payment reminders
              </li>
              <li className="flex items-center text-sm text-gray-700">
                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                Emergency warnings
              </li>
            </ul>
          </div>

          {/* Feature 2 */}
          <div className="bg-white p-8 rounded-2xl border-2 border-gray-200 hover:border-blue-400 transition-all hover:shadow-lg">
            <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">ML Predictions</h3>
            <p className="text-gray-600 mb-4">
              See your financial future with 85%+ accuracy. Trend detection, seasonal adjustment, confidence intervals.
            </p>
            <ul className="space-y-2">
              <li className="flex items-center text-sm text-gray-700">
                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                7/14/30 day forecasts
              </li>
              <li className="flex items-center text-sm text-gray-700">
                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                Risk scoring
              </li>
              <li className="flex items-center text-sm text-gray-700">
                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                Confidence intervals
              </li>
            </ul>
          </div>

          {/* Feature 3 */}
          <div className="bg-white p-8 rounded-2xl border-2 border-gray-200 hover:border-green-400 transition-all hover:shadow-lg">
            <div className="bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Target className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Measurable Impact</h3>
            <p className="text-gray-600 mb-4">
              Track exactly how much the AI saves you. Every suggestion shows its financial impact.
            </p>
            <ul className="space-y-2">
              <li className="flex items-center text-sm text-gray-700">
                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                Total savings dashboard
              </li>
              <li className="flex items-center text-sm text-gray-700">
                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                Acceptance rate tracking
              </li>
              <li className="flex items-center text-sm text-gray-700">
                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                Achievement system
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Social Proof */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Built for India's Gig Economy</h2>
          <p className="text-xl text-gray-600">
            500M+ Indians work with irregular income. Traditional banking doesn't serve them. RythmIQ does.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-xl border-2 border-gray-200">
            <Award className="h-10 w-10 text-purple-600 mb-4" />
            <h3 className="font-bold text-gray-900 mb-2">For Freelancers</h3>
            <p className="text-gray-600 text-sm">
              Handle irregular income with smart predictions and auto-save suggestions.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border-2 border-gray-200">
            <Zap className="h-10 w-10 text-blue-600 mb-4" />
            <h3 className="font-bold text-gray-900 mb-2">For Gig Workers</h3>
            <p className="text-gray-600 text-sm">
              Never miss a bill payment. Get alerts before balance drops too low.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border-2 border-gray-200">
            <Shield className="h-10 w-10 text-green-600 mb-4" />
            <h3 className="font-bold text-gray-900 mb-2">Privacy-First</h3>
            <p className="text-gray-600 text-sm">
              Your data never leaves your control. No selling to advertisers. Ever.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-black text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Take Control?</h2>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Join thousands of Indians who are using AI to prevent financial problems before they happen.
          </p>

          <div className="flex gap-4 justify-center">
            <Link href="/sign-up">
              <Button size="lg" className="bg-white text-black hover:bg-gray-200 px-8">
                Start Free Today
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>

          <p className="text-sm text-gray-500 mt-6">
            ₹50 Lakh Hackathon Submission • Built with ❤️ for India
          </p>
        </div>
      </div>
    </div>
  );
}
