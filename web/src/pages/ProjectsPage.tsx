import { useState } from 'react';
import { Search, FolderOpen, MessageSquare, Clock, Target } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';

export default function ProjectsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const { data, isLoading, error } = useProjects();

  const filteredProjects = data?.projects.filter((project) =>
    project.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (isoString: string | null) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Projects</h2>
        <p className="text-gray-400">{data?.projects.length ?? 0} projects</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-dark-surface border border-dark-border rounded-lg
                     text-gray-100 placeholder-gray-500 focus:outline-none focus:border-accent-primary"
        />
      </div>

      {/* Project Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-6 w-32 bg-dark-border rounded mb-4"></div>
              <div className="h-4 w-full bg-dark-border rounded mb-2"></div>
              <div className="h-4 w-3/4 bg-dark-border rounded"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="card">
          <p className="text-red-400">Error loading projects: {error.message}</p>
        </div>
      ) : filteredProjects && filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <div key={project.id} className="card-hover cursor-pointer">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-accent-secondary/10 rounded-lg">
                  <FolderOpen className="text-accent-secondary" size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{project.displayName}</h3>
                  <p className="text-xs text-gray-500 truncate">{project.path}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="flex items-center gap-1 text-gray-400">
                  <MessageSquare size={14} />
                  <span>{project.conversationCount}</span>
                </div>
                <div className="flex items-center gap-1 text-gray-400">
                  <Clock size={14} />
                  <span>{formatDate(project.lastActive)}</span>
                </div>
                <div className="flex items-center gap-1 text-accent-success">
                  <Target size={14} />
                  <span>{(project.avgEffectiveness * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <FolderOpen className="mx-auto text-gray-500 mb-4" size={48} />
          <p className="text-gray-400">
            {searchQuery ? 'No projects match your search' : 'No projects found'}
          </p>
        </div>
      )}
    </div>
  );
}
