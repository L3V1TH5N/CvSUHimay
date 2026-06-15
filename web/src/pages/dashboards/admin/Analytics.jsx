// file path: web/src/pages/dashboards/admin/Analytics.jsx

import { useState } from "react";
import { 
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  BookOpen,
  Award,
  Clock,
  Activity,
  Download,
  Calendar
} from "lucide-react";

const Analytics = () => {
  const [timeframe, setTimeframe] = useState("week");

  const overallStats = {
    totalUsers: 156,
    userGrowth: 12.5,
    activeUsers: 124,
    activeRate: 79.5,
    totalCourses: 24,
    courseGrowth: 8.3,
    completionRate: 68.4,
    avgEngagement: 76.2
  };

  const userGrowthData = [
    { month: "Jan", students: 45, instructors: 12 },
    { month: "Feb", students: 62, instructors: 18 },
    { month: "Mar", students: 89, instructors: 25 },
    { month: "Apr", students: 120, instructors: 35 }
  ];

  const coursePerformance = [
    { name: "Basic Fish Anatomy", enrolled: 45, completed: 35, avgScore: 85, engagement: 92 },
    { name: "Filleting Techniques", enrolled: 38, completed: 25, avgScore: 78, engagement: 86 },
    { name: "Advanced Deboning", enrolled: 28, completed: 15, avgScore: 72, engagement: 78 },
    { name: "Fish Species ID", enrolled: 52, completed: 46, avgScore: 90, engagement: 95 },
    { name: "Knife Skills", enrolled: 35, completed: 30, avgScore: 88, engagement: 90 }
  ];

  const engagementMetrics = [
    { metric: "Avg. Session Duration", value: "24 min", change: 8.3, trend: "up" },
    { metric: "Daily Active Users", value: "42", change: 5.2, trend: "up" },
    { metric: "Course Completion Rate", value: "68%", change: -2.1, trend: "down" },
    { metric: "Avg. Lessons per Week", value: "12", change: 15.6, trend: "up" }
  ];

  const topInstructors = [
    { name: "Prof. Emily Davis", courses: 5, students: 67, rating: 4.9, satisfaction: 98 },
    { name: "Prof. Michael Chen", courses: 4, students: 52, rating: 4.8, satisfaction: 96 },
    { name: "Prof. Lisa Wong", courses: 3, students: 38, rating: 4.6, satisfaction: 94 }
  ];

  const learningActivity = [
    { day: "Mon", lessons: 45, simulations: 28 },
    { day: "Tue", lessons: 52, simulations: 35 },
    { day: "Wed", lessons: 48, simulations: 30 },
    { day: "Thu", lessons: 58, simulations: 38 },
    { day: "Fri", lessons: 42, simulations: 25 },
    { day: "Sat", lessons: 25, simulations: 15 },
    { day: "Sun", lessons: 18, simulations: 10 }
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Reports & Analytics</h1>
            <p className="text-gray-600 mt-2">Platform insights and performance metrics</p>
          </div>
          <div className="flex gap-3">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="quarter">Last 3 Months</option>
              <option value="year">Last Year</option>
            </select>
            <button className="px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm">
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <span className="flex items-center text-sm font-medium text-green-600">
              <TrendingUp className="w-4 h-4 mr-1" />
              {overallStats.userGrowth}%
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{overallStats.totalUsers}</p>
          <p className="text-sm text-gray-600 mt-1">Total Users</p>
          <p className="text-xs text-gray-500 mt-1">{overallStats.activeUsers} active ({overallStats.activeRate}%)</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-green-600" />
            </div>
            <span className="flex items-center text-sm font-medium text-green-600">
              <TrendingUp className="w-4 h-4 mr-1" />
              {overallStats.courseGrowth}%
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{overallStats.totalCourses}</p>
          <p className="text-sm text-gray-600 mt-1">Total Courses</p>
          <p className="text-xs text-gray-500 mt-1">18 active courses</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <Award className="w-5 h-5 text-purple-600" />
            </div>
            <span className="flex items-center text-sm font-medium text-red-600">
              <TrendingDown className="w-4 h-4 mr-1" />
              2.1%
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{overallStats.completionRate}%</p>
          <p className="text-sm text-gray-600 mt-1">Completion Rate</p>
          <p className="text-xs text-gray-500 mt-1">Average across all courses</p>
        </div>

        <div className="bg-blue-600 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="flex items-center text-sm font-medium text-blue-100">
              <TrendingUp className="w-4 h-4 mr-1" />
              5.3%
            </span>
          </div>
          <p className="text-2xl font-bold">{overallStats.avgEngagement}%</p>
          <p className="text-sm text-blue-100 mt-1">Avg Engagement</p>
          <p className="text-xs text-blue-200 mt-1">Platform-wide metric</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* User Growth Chart */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">User Growth Trend</h2>
              <p className="text-sm text-gray-600 mt-1">Monthly student and instructor registration</p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {userGrowthData.map((data, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">{data.month} 2024</span>
                      <span className="text-xs text-gray-500">
                        Total: {data.students + data.instructors} users
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600">Students</span>
                          <span className="font-medium text-gray-900">{data.students}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${(data.students / 120) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600">Instructors</span>
                          <span className="font-medium text-gray-900">{data.instructors}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full transition-all"
                            style={{ width: `${(data.instructors / 35) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Course Performance */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Course Performance</h2>
              <p className="text-sm text-gray-600 mt-1">Enrollment, completion and engagement metrics</p>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-gray-200">
                    <tr>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase pb-3">Course</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase pb-3">Enrolled</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase pb-3">Completed</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase pb-3">Avg Score</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase pb-3">Engagement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {coursePerformance.map((course, index) => (
                      <tr key={index}>
                        <td className="py-3 text-sm font-medium text-gray-900">{course.name}</td>
                        <td className="py-3 text-sm text-right text-gray-600">{course.enrolled}</td>
                        <td className="py-3 text-sm text-right text-gray-600">{course.completed}</td>
                        <td className="py-3 text-sm text-right">
                          <span className={`font-semibold ${
                            course.avgScore >= 85 ? 'text-green-600' : 
                            course.avgScore >= 75 ? 'text-blue-600' : 'text-amber-600'
                          }`}>
                            {course.avgScore}%
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <span className={`text-xs font-medium px-2 py-1 rounded ${
                            course.engagement >= 90 ? 'bg-green-50 text-green-700' :
                            course.engagement >= 80 ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {course.engagement}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Learning Activity */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Weekly Learning Activity</h2>
              <p className="text-sm text-gray-600 mt-1">Lessons completed and simulations run</p>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {learningActivity.map((activity, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-700 w-12">{activity.day}</span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${(activity.lessons / 58) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-600 w-16 text-right">{activity.lessons} lessons</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full transition-all"
                            style={{ width: `${(activity.simulations / 38) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-600 w-16 text-right">{activity.simulations} sims</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          {/* Engagement Metrics */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Engagement Metrics</h2>
            </div>
            <div className="p-6 space-y-4">
              {engagementMetrics.map((metric, index) => (
                <div key={index} className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-sm text-gray-600">{metric.metric}</span>
                    <span className={`flex items-center text-xs font-medium ${
                      metric.trend === 'up' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {metric.trend === 'up' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                      {Math.abs(metric.change)}%
                    </span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{metric.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Top Instructors */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Top Instructors</h2>
            </div>
            <div className="p-6 space-y-4">
              {topInstructors.map((instructor, index) => (
                <div key={index} className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-purple-700">
                        {instructor.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{instructor.name}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                        <span>{instructor.courses} courses</span>
                        <span>•</span>
                        <span>{instructor.students} students</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Rating: ⭐ {instructor.rating}</span>
                    <span className="font-medium text-green-600">{instructor.satisfaction}% satisfaction</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats Summary */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-6 text-white shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Platform Summary</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-100">Avg. Course Rating</span>
                <span className="text-lg font-bold">4.7 ⭐</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-100">Total Learning Hours</span>
                <span className="text-lg font-bold">2,840</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-100">Certificates Issued</span>
                <span className="text-lg font-bold">156</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;