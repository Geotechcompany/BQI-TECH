"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Users,
  List,
  Search,
  Loader2,
  CheckCircle,
  X,
  Plus,
  Edit,
  Trash2,
  Info,
} from "lucide-react";
import { adminApi } from "@/lib/api-backend";
import { authService } from "@/lib/auth-backend";
import { toast } from "sonner";
import React from "react";

interface RecipientSelectionProps {
  mode: "all" | "list" | "search" | "broadcast";
  setMode: (mode: "all" | "list" | "search" | "broadcast") => void;
  recipients: string;
  setRecipients: (recipients: string) => void;
  selectedUsers: any[];
  setSelectedUsers: (users: any[]) => void;
  emailCount: number;
  onShowTips: () => void;
  selectedBroadcastList: string | null;
  setSelectedBroadcastList: (listId: string | null) => void;
}

export function RecipientSelection({
  mode,
  setMode,
  recipients,
  setRecipients,
  selectedUsers,
  setSelectedUsers,
  emailCount,
  onShowTips,
  selectedBroadcastList,
  setSelectedBroadcastList,
}: RecipientSelectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [broadcastLists, setBroadcastLists] = useState<any[]>([]);
  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");
  const [creatingList, setCreatingList] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [modalSearchResults, setModalSearchResults] = useState<any[]>([]);
  const [modalSearching, setModalSearching] = useState(false);
  const [modalSelectedUsers, setModalSelectedUsers] = useState<any[]>([]);
  const [editingList, setEditingList] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Load broadcast lists on component mount
  useEffect(() => {
    loadBroadcastLists();
  }, []);

  const loadBroadcastLists = async () => {
    try {
      const response = await adminApi.listBroadcastLists();
      setBroadcastLists(response.broadcastLists || []);
    } catch (error) {
      console.error("Failed to load broadcast lists:", error);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      console.log("Searching users with query:", query);

      // Check if user is authenticated
      const session = authService.getSession();
      console.log("Current session:", session);

      if (!session?.token) {
        throw new Error("No authentication token found");
      }

      const response = await adminApi.searchUsers({ q: query });
      console.log("Search response:", response);
      setSearchResults(response.users || []);
    } catch (error: any) {
      console.error("Search error:", error);
      console.error("Error details:", {
        message: error?.message,
        status: error?.status,
        response: error?.response,
      });

      // If it's an auth error, try to refresh the token
      if (error?.status === 401 || error?.message?.includes("401")) {
        try {
          console.log("Attempting to refresh token...");
          await authService.refreshToken();
          console.log("Token refreshed, retrying search...");
          // Retry the search after token refresh
          const retryResponse = await adminApi.searchUsers({ q: query });
          setSearchResults(retryResponse.users || []);
          return;
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError);
          toast.error(
            "Authentication expired. Please refresh the page and try again."
          );
        }
      } else {
        toast.error("Failed to search users", { description: error?.message });
      }
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const searchUsersInModal = async (query: string) => {
    if (!query.trim()) {
      setModalSearchResults([]);
      return;
    }

    setModalSearching(true);
    try {
      console.log("Searching users with query:", query);

      // Check if user is authenticated
      const session = authService.getSession();
      console.log("Current session:", session);

      if (!session?.token) {
        throw new Error("No authentication token found");
      }

      const response = await adminApi.searchUsers({ q: query });
      console.log("Search response:", response);
      setModalSearchResults(response.users || []);
    } catch (error: any) {
      console.error("Modal search error:", error);
      console.error("Error details:", {
        message: error?.message,
        status: error?.status,
        response: error?.response,
      });

      // If it's an auth error, try to refresh the token
      if (error?.status === 401 || error?.message?.includes("401")) {
        try {
          console.log("Attempting to refresh token...");
          await authService.refreshToken();
          console.log("Token refreshed, retrying search...");
          // Retry the search after token refresh
          const retryResponse = await adminApi.searchUsers({ q: query });
          setModalSearchResults(retryResponse.users || []);
          return;
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError);
          toast.error(
            "Authentication expired. Please refresh the page and try again."
          );
        }
      } else {
        toast.error("Failed to search users", { description: error?.message });
      }
      setModalSearchResults([]);
    } finally {
      setModalSearching(false);
    }
  };

  const loadBroadcastListUsers = async (listId: string) => {
    try {
      const response = await adminApi.getBroadcastListUsers(listId);
      setSelectedUsers(response.users || []);
      setSelectedBroadcastList(listId);
    } catch (error) {
      console.error("Failed to load broadcast list users:", error);
      toast.error("Failed to load broadcast list users");
    }
  };

  const createBroadcastList = async () => {
    if (!newListName.trim() || modalSelectedUsers.length === 0) {
      toast.error("Please provide a list name and select users");
      return;
    }

    setCreatingList(true);
    try {
      const response = await adminApi.createBroadcastList({
        name: newListName,
        description: newListDescription,
        userIds: modalSelectedUsers.map((user) => user._id),
      });

      toast.success("Broadcast list created successfully");
      setShowCreateList(false);
      setNewListName("");
      setNewListDescription("");
      setModalSearchQuery("");
      setModalSearchResults([]);
      setModalSelectedUsers([]);
      loadBroadcastLists();
    } catch (error: any) {
      console.error("Failed to create broadcast list:", error);
      toast.error("Failed to create broadcast list", {
        description: error?.message,
      });
    } finally {
      setCreatingList(false);
    }
  };

  const toggleUserSelection = (user: any) => {
    const isSelected = selectedUsers.some((u) => u._id === user._id);
    if (isSelected) {
      setSelectedUsers(selectedUsers.filter((u) => u._id !== user._id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const toggleModalUserSelection = (user: any) => {
    const isSelected = modalSelectedUsers.some((u) => u._id === user._id);
    if (isSelected) {
      setModalSelectedUsers(
        modalSelectedUsers.filter((u) => u._id !== user._id)
      );
    } else {
      setModalSelectedUsers([...modalSelectedUsers, user]);
    }
  };

  const editBroadcastList = async (list: any) => {
    try {
      // Load the list details and users
      const response = await adminApi.getBroadcastList(list._id);
      const usersResponse = await adminApi.getBroadcastListUsers(list._id);

      setEditingList({
        ...response,
        users: usersResponse.users || [],
      });
      setNewListName(response.name);
      setNewListDescription(response.description || "");
      setModalSelectedUsers(usersResponse.users || []);
      setShowEditModal(true);
    } catch (error: any) {
      console.error("Failed to load broadcast list for editing:", error);
      toast.error("Failed to load broadcast list", {
        description: error?.message,
      });
    }
  };

  const updateBroadcastList = async () => {
    if (
      !editingList ||
      !newListName.trim() ||
      modalSelectedUsers.length === 0
    ) {
      toast.error("Please provide a list name and select users");
      return;
    }

    setCreatingList(true);
    try {
      await adminApi.updateBroadcastList(editingList._id, {
        name: newListName,
        description: newListDescription,
        userIds: modalSelectedUsers.map((user) => user._id),
      });

      toast.success("Broadcast list updated successfully");
      setShowEditModal(false);
      setEditingList(null);
      setNewListName("");
      setNewListDescription("");
      setModalSearchQuery("");
      setModalSearchResults([]);
      setModalSelectedUsers([]);
      loadBroadcastLists();
    } catch (error: any) {
      console.error("Failed to update broadcast list:", error);
      toast.error("Failed to update broadcast list", {
        description: error?.message,
      });
    } finally {
      setCreatingList(false);
    }
  };

  const deleteBroadcastList = async (listId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this broadcast list? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      await adminApi.deleteBroadcastList(listId);
      toast.success("Broadcast list deleted successfully");
      loadBroadcastLists();
    } catch (error: any) {
      console.error("Failed to delete broadcast list:", error);
      toast.error("Failed to delete broadcast list", {
        description: error?.message,
      });
    }
  };

  return (
    <Card className="border-2 border-gray-200 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Recipients
            </CardTitle>
            <CardDescription>
              Choose who will receive this email broadcast
            </CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onShowTips}
                  className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                >
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Tips & Shortcuts</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button
            variant={mode === "all" ? "default" : "outline"}
            onClick={() => setMode("all")}
            className={`h-16 flex flex-col items-center gap-2 ${
              mode === "all"
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "hover:bg-blue-50"
            }`}
          >
            <Users className="h-6 w-6" />
            <div className="text-center">
              <div className="font-semibold">All Users</div>
              <div className="text-xs opacity-75">Send to everyone</div>
            </div>
          </Button>

          <Button
            variant={mode === "list" ? "default" : "outline"}
            onClick={() => setMode("list")}
            className={`h-16 flex flex-col items-center gap-2 ${
              mode === "list"
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "hover:bg-blue-50"
            }`}
          >
            <List className="h-6 w-6" />
            <div className="text-center">
              <div className="font-semibold">Specific Emails</div>
              <div className="text-xs opacity-75">Custom recipient list</div>
            </div>
          </Button>

          <Button
            variant={mode === "search" ? "default" : "outline"}
            onClick={() => setMode("search")}
            className={`h-16 flex flex-col items-center gap-2 ${
              mode === "search"
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "hover:bg-blue-50"
            }`}
          >
            <Search className="h-6 w-6" />
            <div className="text-center">
              <div className="font-semibold">Search Users</div>
              <div className="text-xs opacity-75">Find users in database</div>
            </div>
          </Button>

          <Button
            variant={mode === "broadcast" ? "default" : "outline"}
            onClick={() => setMode("broadcast")}
            className={`h-16 flex flex-col items-center gap-2 ${
              mode === "broadcast"
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "hover:bg-blue-50"
            }`}
          >
            <Users className="h-6 w-6" />
            <div className="text-center">
              <div className="font-semibold">Broadcast Lists</div>
              <div className="text-xs opacity-75">Use saved lists</div>
            </div>
          </Button>
        </div>

        {mode === "list" && (
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700">
              Recipient Emails
            </Label>
            <Textarea
              rows={4}
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="Enter email addresses separated by commas, spaces, or new lines&#10;example@company.com, user@domain.com&#10;another@email.com"
              className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 rounded-xl"
            />
            <div className="text-xs text-gray-500">
              {recipients.split(/[\,\n\s]+/).filter(Boolean).length} emails
              entered
            </div>
          </div>
        )}

        {mode === "search" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">
                Search Users
              </Label>
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") searchUsers(searchQuery);
                  }}
                  placeholder="Search by name, email, or username"
                  className="flex-1 border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 rounded-xl"
                />
                <Button
                  onClick={() => searchUsers(searchQuery)}
                  disabled={searching || !searchQuery.trim()}
                  className="px-6"
                >
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">
                  Search Results ({searchResults.length})
                </Label>
                <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2">
                  {searchResults.map((user) => (
                    <div
                      key={user._id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          <span className="text-xs">
                            {user.firstName} {user.lastName} ({user.email})
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {user.email}
                        </div>
                      </div>
                      <Checkbox
                        checked={selectedUsers.some((u) => u._id === user._id)}
                        onCheckedChange={() => toggleUserSelection(user)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedUsers.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">
                  Selected Users ({selectedUsers.length})
                </Label>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((user) => (
                    <Badge
                      key={user._id}
                      variant="secondary"
                      className="flex items-center gap-1 pr-1"
                    >
                      <span className="text-xs">
                        {user.firstName} {user.lastName} ({user.email})
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleUserSelection(user)}
                        className="h-4 w-4 p-0 hover:bg-transparent"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {mode === "broadcast" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-gray-700">
                Broadcast Lists
              </Label>
              <Button
                size="sm"
                onClick={() => setShowCreateList(true)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Plus className="h-4 w-4 mr-1" />
                Create List
              </Button>
            </div>

            {broadcastLists.length > 0 ? (
              <div className="space-y-2">
                {broadcastLists.map((list) => (
                  <div
                    key={list._id}
                    className={`p-3 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                      selectedBroadcastList === list._id
                        ? "border-blue-400 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                    onClick={() => {
                      loadBroadcastListUsers(list._id);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {list.name}
                        </div>
                        <div className="text-sm text-gray-600">
                          {list.description || "No description"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {list.userCount} users
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedBroadcastList === list._id && (
                          <div className="flex items-center gap-1 text-blue-600 text-sm">
                            <CheckCircle className="h-4 w-4" />
                            <span>Selected</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              editBroadcastList(list);
                            }}
                            className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteBroadcastList(list._id);
                            }}
                            className="h-8 w-8 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-sm">No broadcast lists found</p>
                <p className="text-xs">
                  Create your first broadcast list to get started
                </p>
              </div>
            )}

            {selectedUsers.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">
                  Selected Users ({selectedUsers.length})
                </Label>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((user) => (
                    <Badge
                      key={user._id}
                      variant="secondary"
                      className="flex items-center gap-1 pr-1"
                    >
                      <span className="text-xs">
                        {user.firstName} {user.lastName} ({user.email})
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleUserSelection(user)}
                        className="h-4 w-4 p-0 hover:bg-transparent"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Create Broadcast List Modal */}
        {showCreateList && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <Card className="border-2 border-gray-200 shadow-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Create Broadcast List
                  </CardTitle>
                  <CardDescription>
                    Create a new broadcast list with selected users
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700">
                      List Name
                    </Label>
                    <Input
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="Enter list name..."
                      className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700">
                      Description (Optional)
                    </Label>
                    <Textarea
                      rows={3}
                      value={newListDescription}
                      onChange={(e) => setNewListDescription(e.target.value)}
                      placeholder="Enter description..."
                      className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 rounded-xl"
                    />
                  </div>
                  <div className="text-sm text-gray-600">
                    {modalSelectedUsers.length} users will be added to this list
                  </div>

                  {/* User Search and Selection */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-gray-700">
                        Search and Add Users
                      </Label>
                      <p className="text-xs text-gray-500">
                        Search for users to add to this broadcast list. You can
                        search by name, email, or username.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          value={modalSearchQuery}
                          onChange={(e) => setModalSearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              searchUsersInModal(modalSearchQuery);
                          }}
                          placeholder="Search by name, email, or username"
                          className="flex-1 border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 rounded-xl"
                        />
                        <Button
                          onClick={() => searchUsersInModal(modalSearchQuery)}
                          disabled={modalSearching || !modalSearchQuery.trim()}
                          className="px-6"
                        >
                          {modalSearching ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {modalSearchResults.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">
                          Search Results ({modalSearchResults.length})
                        </Label>
                        <div className="max-h-32 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2">
                          {modalSearchResults.map((user) => (
                            <div
                              key={user._id}
                              className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">
                                  <span className="text-xs">
                                    {user.firstName} {user.lastName} (
                                    {user.email})
                                  </span>
                                </div>
                                <div className="text-sm text-gray-600">
                                  {user.email}
                                </div>
                              </div>
                              <Checkbox
                                checked={modalSelectedUsers.some(
                                  (u) => u._id === user._id
                                )}
                                onCheckedChange={() =>
                                  toggleModalUserSelection(user)
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {modalSelectedUsers.length > 0 ? (
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">
                          Selected Users ({modalSelectedUsers.length})
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {modalSelectedUsers.map((user) => (
                            <Badge
                              key={user._id}
                              variant="secondary"
                              className="flex items-center gap-1 pr-1"
                            >
                              <span className="text-xs">
                                <span className="text-xs">
                                  {user.firstName} {user.lastName} ({user.email}
                                  )
                                </span>{" "}
                                ({user.email})
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleModalUserSelection(user)}
                                className="h-4 w-4 p-0 hover:bg-transparent"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm">No users selected yet</p>
                        <p className="text-xs">
                          Search and select users to add to this list
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
                <div className="flex gap-2 p-6 pt-0">
                  <Button
                    onClick={() => {
                      setShowCreateList(false);
                      setNewListName("");
                      setNewListDescription("");
                      setModalSearchQuery("");
                      setModalSearchResults([]);
                      setModalSelectedUsers([]);
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={createBroadcastList}
                    disabled={
                      !newListName.trim() ||
                      modalSelectedUsers.length === 0 ||
                      creatingList
                    }
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    {creatingList ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating...
                      </div>
                    ) : (
                      "Create List"
                    )}
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}
      </CardContent>

      {/* Edit Broadcast List Modal */}
      {showEditModal && (
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Broadcast List</DialogTitle>
              <DialogDescription>
                Update the broadcast list name, description, and users.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">
                  List Name *
                </Label>
                <Input
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="Enter list name"
                  className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">
                  Description
                </Label>
                <Textarea
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                  placeholder="Enter list description"
                  rows={3}
                  className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 rounded-xl"
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700">
                    Search Users
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={modalSearchQuery}
                      onChange={(e) => setModalSearchQuery(e.target.value)}
                      placeholder="Search by name or email"
                      className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 rounded-xl"
                    />
                    <Button
                      onClick={() => searchUsersInModal(modalSearchQuery)}
                      disabled={modalSearching || !modalSearchQuery.trim()}
                      className="px-6 bg-blue-600 hover:bg-blue-700 text-white border-0"
                    >
                      {modalSearching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {modalSearchResults.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700">
                      Search Results
                    </Label>
                    <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-2">
                      {modalSearchResults.map((user) => {
                        const isSelected = modalSelectedUsers.some(
                          (u) => u._id === user._id
                        );
                        return (
                          <div
                            key={user._id}
                            className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded"
                          >
                            <Checkbox
                              id={`modal-${user._id}`}
                              checked={isSelected}
                              onCheckedChange={() =>
                                toggleModalUserSelection(user)
                              }
                            />
                            <Label
                              htmlFor={`modal-${user._id}`}
                              className="flex-1 text-sm cursor-pointer"
                            >
                              {user.firstName} {user.lastName} ({user.email})
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {modalSelectedUsers.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700">
                      Selected Users ({modalSelectedUsers.length})
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {modalSelectedUsers.map((user) => (
                        <Badge
                          key={user._id}
                          variant="secondary"
                          className="flex items-center gap-1 pr-1"
                        >
                          <span className="text-xs">
                            {user.firstName} {user.lastName} ({user.email})
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleModalUserSelection(user)}
                            className="h-4 w-4 p-0 hover:bg-transparent"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {modalSelectedUsers.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No users selected</p>
                    <p className="text-xs">
                      Search and select users to add to this list
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingList(null);
                  setNewListName("");
                  setNewListDescription("");
                  setModalSearchQuery("");
                  setModalSearchResults([]);
                  setModalSelectedUsers([]);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={updateBroadcastList}
                disabled={
                  creatingList ||
                  !newListName.trim() ||
                  modalSelectedUsers.length === 0
                }
                className="bg-blue-600 hover:bg-blue-700 text-white border-0"
              >
                {creatingList ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating...
                  </div>
                ) : (
                  "Update List"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
