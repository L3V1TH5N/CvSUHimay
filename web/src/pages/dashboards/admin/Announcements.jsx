// file path: web/src/pages/dashboards/admin/Announcements.jsx

import { useState } from "react";
import { 
  Bell,
  Plus,
  Send,
  Edit,
  Trash2,
  Eye,
  Users,
  GraduationCap,
  Globe,
  CheckCircle,
  Clock,
  AlertCircle
} from "lucide-react";

const Announcements = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAudience, setSelectedAudience] = useState("all");

  const announcements = [
    {
      id: 1,
      title: "Platform Maintenance Scheduled",
      message: "The platform will undergo scheduled maintenance on Saturday, March 30, from 2:00 AM to 6:00 AM. During this time, some features may be temporarily unavailable.",
      audience: "all",
      status: "published",
      author: "Admin",
      createdDate: "Mar 25, 2024",
      publishedDate: "Mar 25, 2024",
      views: 145,
      priority: "high"
    },
    {
      id: 2,
      title: "New Course Available: Advanced Filleting",
      message: "We're excited to announce a new advanced course on filleting techniques. Enroll now to master professional filleting skills!",
      audience: "students",
      status: "published",
      author: "Admin",
      createdDate: "Mar 22, 2024",
      publishedDate: "Mar 22, 2024",
      views: 98,
      priority: "medium"
    },
    {
      id: 3,
      title: "Instructor Training Workshop",
      message: "Join us for a comprehensive training workshop on creating engaging course content. Registration closes this Friday.",
      audience: "instructors",
      status: "published",
      author: "Admin",
      createdDate: "Mar 20, 2024",
      publishedDate: "Mar 20, 2024",
      views: 32,
      priority: "medium"
    },
    {
      id: 4,
      title: "System Update: New Features Coming Soon",
      message: "We're rolling out exciting new features including enhanced simulation tools and improved progress tracking. Stay tuned!",
      audience: "all",
      status: "scheduled",
      author: "Admin",
      createdDate: "Mar 26, 2024",
      scheduledDate: "Mar 28, 2024",
      views: 0,
      priority: "low"
    },
    {
      id: 5,
      title: "End of Semester Certificates",
      message: "Congratulations to all students who completed their courses this semester! Certificates will be available for download starting next week.",
      audience: "students",
      status: "draft",
      author: "Admin",
      createdDate: "Mar 26, 2024",
      views: 0,
      priority: "medium"
    }
  ];

  const getStatusBadge = (status) => {
    const styles = {
      "published": { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", icon: CheckCircle },
      "scheduled": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: Clock },
      "draft": { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200", icon: AlertCircle }
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

  const getPriorityBadge = (priority) => {
    const styles = {
      "high": "bg-red-50 text-red-700 border-red-200",
      "medium": "bg-amber-50 text-amber-700 border-amber-200",
      "low": "bg-gray-50 text-gray-600 border-gray-200"
    };
    return (
      <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${styles[priority]}`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
      </span>
    );
  };

  const getAudienceIcon = (audience) => {
    if (audience === "students") return <Users className="w-4 h-4" />;
    if (audience === "instructors") return <GraduationCap className="w-4 h-4" />;
    return <Globe className="w-4 h-4" />;
  };

  const getAudienceLabel = (audience) => {
    if (audience === "students") return "Students";
    if (audience === "instructors") return "Instructors";
    return "All Users";
  };

  const stats = {
    total: announcements.length,
    published: announcements.filter(a => a.status === "published").length,
    scheduled: announcements.filter(a => a.status === "scheduled").length,
    drafts: announcements.filter(a => a.status === "draft").length
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Announcements</h1>
            <p className="text-gray-600 mt-2">Communicate with your platform users</p>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Create Announcement
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-600">Total</p>
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
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{stats.scheduled}</p>
              <p className="text-sm text-gray-600">Scheduled</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{stats.drafts}</p>
              <p className="text-sm text-gray-600">Drafts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {announcements.map((announcement) => (
          <div
            key={announcement.id}
            className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all"
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {getStatusBadge(announcement.status)}
                    {getPriorityBadge(announcement.priority)}
                    <span className="px-2.5 py-1 rounded-md text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
                      {getAudienceIcon(announcement.audience)}
                      {getAudienceLabel(announcement.audience)}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{announcement.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{announcement.message}</p>
                </div>
              </div>

              {/* Meta Info */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>By {announcement.author}</span>
                  <span>•</span>
                  <span>Created: {announcement.createdDate}</span>
                  {announcement.publishedDate && (
                    <>
                      <span>•</span>
                      <span>Published: {announcement.publishedDate}</span>
                    </>
                  )}
                  {announcement.scheduledDate && (
                    <>
                      <span>•</span>
                      <span>Scheduled for: {announcement.scheduledDate}</span>
                    </>
                  )}
                  {announcement.views > 0 && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        {announcement.views} views
                      </span>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <button className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                    <Edit className="w-4 h-4" />
                  </button>
                  {announcement.status === "draft" && (
                    <button className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1">
                      <Send className="w-4 h-4" />
                      Publish
                    </button>
                  )}
                  <button className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal (Simple placeholder) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-semibold text-gray-900">Create Announcement</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  placeholder="Enter announcement title..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  rows="6"
                  placeholder="Enter announcement message..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
                ></textarea>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Audience
                  </label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors">
                    <option value="all">All Users</option>
                    <option value="students">Students Only</option>
                    <option value="instructors">Instructors Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button 
                onClick={() => setShowCreateModal(false)}
                className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button className="px-6 py-2.5 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors">
                Save as Draft
              </button>
              <button className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                <Send className="w-4 h-4" />
                Publish Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Announcements;