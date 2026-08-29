import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function AdminResourcesView() {
  const { toast } = useToast();

  const [resources, setResources] = useState([
    { id: "1", title: "Managing Stress", category: "Mental Health", active: true },
    { id: "2", title: "Sleep Hygiene", category: "Wellness", active: true },
  ]);

  const [contacts, setContacts] = useState([
    { id: "1", label: "National Helpline", contact: "1800-111-222", hours: "24/7", active: true },
    { id: "2", label: "Unit Counselor", contact: "counselor@unit.local", hours: "0900-1700", active: true },
  ]);

  const toggleResource = (id: string) => {
    setResources(resources.map(r => r.id === id ? { ...r, active: !r.active } : r));
    toast({ title: "Resource updated" });
  };

  const toggleContact = (id: string) => {
    setContacts(contacts.map(c => c.id === id ? { ...c, active: !c.active } : c));
    toast({ title: "Contact updated" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Content & Resources</h2>
        <p className="text-muted-foreground">Manage self-help materials, emergency contacts, assessments, and ML engine telemetry.</p>
      </div>

      <Tabs defaultValue="resources" className="space-y-4">
        <TabsList>
          <TabsTrigger value="resources">Self-Help Resources</TabsTrigger>
          <TabsTrigger value="contacts">Emergency Contacts</TabsTrigger>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
          <TabsTrigger value="telemetry">ML Telemetry</TabsTrigger>
        </TabsList>

        <TabsContent value="resources" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Educational Articles & Modules</h3>
            <Button>Add Resource</Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resources.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.title}</TableCell>
                      <TableCell>{r.category}</TableCell>
                      <TableCell>
                        <Badge variant={r.active ? "default" : "secondary"}>{r.active ? "Active" : "Draft"}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={r.active} onCheckedChange={() => toggleResource(r.id)} />
                          <Button variant="outline" size="sm">Edit</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Crisis & Support Contacts</h3>
            <Button>Add Contact</Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Contact Info</TableHead>
                    <TableHead>Available Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.label}</TableCell>
                      <TableCell>{c.contact}</TableCell>
                      <TableCell>{c.hours}</TableCell>
                      <TableCell>
                        <Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Active" : "Hidden"}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={c.active} onCheckedChange={() => toggleContact(c.id)} />
                          <Button variant="outline" size="sm">Edit</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assessments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Assessment Configuration</CardTitle>
              <CardDescription>Manage questions for PHQ-9, GAD-7 and custom military screening tools.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Module under construction. Will allow setting score weights and logic branching.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="telemetry" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">DistilBERT (Risk Class.)</CardTitle>
                <Badge variant="default">Healthy</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12ms</div>
                <p className="text-xs text-muted-foreground">Avg Latency (last 1h)</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">135M LLM</CardTitle>
                <Badge variant="default">Healthy</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">142ms</div>
                <p className="text-xs text-muted-foreground">Avg Latency (last 1h)</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">SentenceTransformers</CardTitle>
                <Badge variant="default">Healthy</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">45ms</div>
                <p className="text-xs text-muted-foreground">RAG Embedding Time</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Whisper STT</CardTitle>
                <Badge variant="secondary">Idle</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">--</div>
                <p className="text-xs text-muted-foreground">No active streams</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AdminResourcesView;
