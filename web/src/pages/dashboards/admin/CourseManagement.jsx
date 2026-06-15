// file path: web/src/pages/dashboards/admin/CourseManagement.jsx

import { useState } from "react";
import {
  BookOpen,
  Search,
  Eye,
  Edit,
  Trash2,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  BarChart3,
  Download,
  AlertCircle,
  MoreVertical,
  Ban,
  X
} from "lucide-react";

const CourseManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [openMenuId, setOpenMenuId] = useState(null);

  const courses = [
    {
      id: 1,
      name: "Basic Fish Anatomy",
      instructor: "Prof. Michael Chen",
      instructorEmail: "m.chen@university.edu",
      description: "Fundamental bone structure and anatomy of common fish species",
      status: "published",
      level: "Beginner",
      enrolled: 45,
      lessons: 8,
      duration: "4 hours",
      avgProgress: 78,
      avgScore: 85,
      rating: 4.8,
      reviews: 32,
      createdDate: "Jan 15, 2024",
      lastUpdated: "2 days ago"
    },
    {
      id: 2,
      name: "Filleting Techniques",
      instructor: "Prof. Lisa Wong",
      instructorEmail: "l.wong@university.edu",
      description: "Master the art of filleting various types of fish",
      status: "published",
      level: "Intermediate",
      enrolled: 38,
      lessons: 10,
      duration: "6 hours",
      avgProgress: 65,
      avgScore: 78,
      rating: 4.6,
      reviews: 28,
      createdDate: "Feb 10, 2024",
      lastUpdated: "1 week ago"
    },
    {
      id: 3,
      name: "Advanced Deboning",
      instructor: "Prof. Emily Davis",
      instructorEmail: "e.davis@university.edu",
      description: "Advanced techniques for complete fish deboning",
      status: "published",
      level: "Advanced",
      enrolled: 28,
      lessons: 12,
      duration: "8 hours",
      avgProgress: 52,
      avgScore: 72,
      rating: 4.9,
      reviews: 15,
      createdDate: "Jan 20, 2024",
      lastUpdated: "3 days ago"
    },
    {
      id: 4,
      name: "Knife Skills & Safety",
      instructor: "Prof. David Smith",
      instructorEmail: "d.smith@university.edu",
      description: "Essential knife handling and safety practices",
      status: "pending",
      level: "Beginner",
      enrolled: 0,
      lessons: 6,
      duration: "3 hours",
      avgProgress: 0,
      avgScore: 0,
      rating: 0,
      reviews: 0,
      createdDate: "Mar 15, 2024",
      lastUpdated: "5 hours ago"
    },
    {
      id: 5,
      name: "Fish Species Identification",
      instructor: "Prof. Emily Davis",
      instructorEmail: "e.davis@university.edu",
      description: "Identify and understand different fish species",
      status: "published",
      level: "Beginner",
      enrolled: 52,
      lessons: 5,
      duration: "2 hours",
      avgProgress: 88,
      avgScore: 90,
      rating: 4.7,
      reviews: 45,
      createdDate: "Feb 5, 2024",
      lastUpdated: "2 weeks ago"
    },
    {
      id: 6,
      name: "Professional Presentation",
      instructor: "Prof. Michael Chen",
      instructorEmail: "m.chen@university.edu",
      description: "Present and plate deboned fish professionally",
      status: "draft",
      level: "Advanced",
      enrolled: 0,
      lessons: 7,
      duration: "5 hours",
      avgProgress: 0,
      avgScore: 0,
      rating: 0,
      reviews: 0,
      createdDate: "Mar 10, 2024",
      lastUpdated: "1 day ago"
    },
    {
      id: 7,
      name: "Sustainable Fishing Practices",
      instructor: "Prof. Lisa Wong",
      instructorEmail: "l.wong@university.edu",
      description: "Learn about sustainable and ethical fishing methods",
      status: "published",
      level: "Intermediate",
      enrolled: 35,
      lessons: 9,
      duration: "5 hours",
      avgProgress: 70,
      avgScore: 82,
      rating: 4.5,
      reviews: 30,
      createdDate: "Feb 20, 2024",
      lastUpdated: "4 days ago"
    },
    {
      id: 8,
      name: "Commercial Fish Processing",
      instructor: "Prof. David Smith",
      instructorEmail: "d.smith@university.edu",
      description: "Industrial-scale fish processing techniques",
      status: "archived",
      level: "Advanced",
      enrolled: 12,
      lessons: 10,
      duration: "7 hours",
      avgProgress: 45,
      avgScore: 68,
      rating: 4.2,
      reviews: 8,
      createdDate: "Jan 5, 2024",
      lastUpdated: "1 month ago"
    }
  ];

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.instructor.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || course.status === filterStatus;
    const matchesLevel = filterLevel === "all" || course.level === filterLevel;
    return matchesSearch && matchesStatus && matchesLevel;
  });

  // Stats react to the current filtered set, not the global list
  const stats = {
    totalCourses: filteredCourses.length,
    published: filteredCourses.filter(c => c.status === "published").length,
    pending: filteredCourses.filter(c => c.status === "pending").length,
    totalEnrolled: filteredCourses.reduce((acc, c) => acc + c.enrolled, 0)
  };

  const levelAccent = {
    "Beginner": "bg-green-500",
    "Intermediate": "bg-amber-500",
    "Advanced": "bg-red-500"
  };

  const getStatusBadge = (status) => {
    const styles = {
      "published": { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", icon: CheckCircle },
      "pending": { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", icon: Clock },
      "draft": { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200", icon: AlertCircle },
      "archived": { bg: "bg-gray-100", text: "text-gray-500", border: "border-gray-200", icon: XCircle }
    };
    const style = styles[status];
    const Icon = style.icon;
    return (
      <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${style.bg} ${style.text} ${style.border} flex items-center gap-1 w-fit`}>
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getLevelBadge = (level) => {
    const styles = {
      "Beginner": "bg-green-50 text-green-700 border-green-200",
      "Intermediate": "bg-amber-50 text-amber-700 border-amber-200",
      "Advanced": "bg-red-50 text-red-700 border-red-200"
    };
    return (
      <span className={`px-2.5 py-1 rounded-md border text-xs font-medium ${styles[level]}`}>
        {level}
      </span>
    );
  };

  const MiniBar = ({ value, color }) => (
    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1.5">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  );

  const hasActiveFilters = filterStatus !== "all" || filterLevel !== "all";

  return (
    <div className="p-8">
      {/* Backdrop — closes any open overflow menu on outside click */}
      {openMenuId !== null && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Course Management</h1>
            <p className="text-gray-600 mt-2">Manage all platform courses</p>
          </div>
          <button className="px-4 py-2.5 bg-white text-gray-700 border border-gray-300 font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Stats Overview — numbers reflect current filtered set */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalCourses}</p>
              <p className="text-sm text-gray-600">Total Courses</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{stats.published}</p>
              <p className="text-sm text-gray-600">Published</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{stats.pending}</p>
              <p className="text-sm text-gray-600">Pending Review</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalEnrolled}</p>
              <p className="text-sm text-gray-600">Total Enrollments</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search courses or instructors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="pending">Pending</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Levels</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs text-gray-500">Filters:</span>
            {filterStatus !== "all" && (
              <button
                onClick={() => setFilterStatus("all")}
                className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-medium hover:bg-blue-100 transition-colors"
              >
                {filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}
                <X className="w-3 h-3" />
              </button>
            )}
            {filterLevel !== "all" && (
              <button
                onClick={() => setFilterLevel("all")}
                className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-medium hover:bg-blue-100 transition-colors"
              >
                {filterLevel}
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => { setFilterStatus("all"); setFilterLevel("all"); }}
              className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500 mb-6">
        Showing {filteredCourses.length} of {courses.length} courses
      </p>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredCourses.map((course) => (
          <div
            key={course.id}
            className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all"
          >
            {/* Top accent bar — color encodes difficulty level */}
            <div className={`h-1 rounded-t-lg ${levelAccent[course.level]}`} />

            {/* Course Body */}
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{course.name}</h3>
              <div className="flex items-center gap-2 flex-wrap mb-3">
                {getStatusBadge(course.status)}
                {getLevelBadge(course.level)}
              </div>
              <p className="text-sm text-gray-500">{course.description}</p>
              <p className="text-xs text-gray-400 mt-3">{course.instructor}</p>

              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-500">Enrolled</p>
                  <p className="text-sm font-medium text-gray-900">{course.enrolled}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Lessons</p>
                  <p className="text-sm font-medium text-gray-900">{course.lessons}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Duration</p>
                  <p className="text-sm font-medium text-gray-900">{course.duration}</p>
                </div>
              </div>
            </div>

            {/* Stats — always visible; dashes when no data */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Avg Progress</p>
                  {course.enrolled > 0 ? (
                    <>
                      <p className="text-sm font-semibold text-gray-900">{course.avgProgress}%</p>
                      <MiniBar value={course.avgProgress} color="bg-blue-500" />
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">—</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Avg Score</p>
                  {course.enrolled > 0 ? (
                    <>
                      <p className="text-sm font-semibold text-gray-900">{course.avgScore}%</p>
                      <MiniBar value={course.avgScore} color="bg-green-500" />
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">—</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Rating</p>
                  {course.rating > 0 ? (
                    <p className="text-sm font-semibold text-gray-900">{course.rating} / 5</p>
                  ) : (
                    <p className="text-sm text-gray-400">—</p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 flex items-center justify-between gap-2">
              <span className="text-xs text-gray-400">Updated {course.lastUpdated}</span>
              <div className="flex items-center gap-2">
                {course.status === "pending" && (
                  <button className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 transition-colors flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Approve
                  </button>
                )}
                <button className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  View Details
                </button>

                {/* Overflow menu — Analytics, Edit, Reject (pending only), Delete */}
                <div className="relative z-20">
                  <button
                    onClick={() => setOpenMenuId(openMenuId === course.id ? null : course.id)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {openMenuId === course.id && (
                    <div className="absolute right-0 bottom-full mb-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20">
                      <button className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 text-left transition-colors">
                        <BarChart3 className="w-4 h-4 text-gray-400" />
                        Analytics
                      </button>
                      <button className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 text-left transition-colors">
                        <Edit className="w-4 h-4 text-gray-400" />
                        Edit Course
                      </button>
                      {course.status === "pending" && (
                        <button className="w-full px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 flex items-center gap-2 text-left transition-colors">
                          <Ban className="w-4 h-4" />
                          Reject
                        </button>
                      )}
                      <div className="my-1 border-t border-gray-100" />
                      <button className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 text-left transition-colors">
                        <Trash2 className="w-4 h-4" />
                        Delete Course
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredCourses.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No courses found</h3>
          <p className="text-gray-600">Try adjusting your search or filter criteria</p>
        </div>
      )}
    </div>
  );
};

export default CourseManagement;
