import { useServerActions } from '../useServerActions';
import { useState } from 'react';
import { ServerListSection } from '../ServerListSection';
import { ServerFormModal } from '../ServerFormModal';
import { CommandSection } from '../CommandSection';
import { ComplianceSection } from '../ComplianceSection';
import { AiCommandSection } from '../AiCommandSection';
import { ServerToolbar } from './ServerToolbar';
import { ServerGroupModal } from './ServerGroupModal';
import { ServerImportSection } from './ServerImportSection';
import { ServerDeleteConfirmModal } from './ServerDeleteConfirmModal';
import { ServerComplianceOptionsModal } from './ServerComplianceOptionsModal';
import BatchCommandModal from '../BatchCommandModal';
import { CommandHistorySection } from './CommandHistorySection';
import { ComplianceHistorySection } from './ComplianceHistorySection';

export default function Servers() {
  const actions = useServerActions();

  // 批量执行命令：勾选服务器 + 批量下发
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const toggleBatchSelect = (id: string) => {
    setBatchSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const {
    isModalOpen, setIsModalOpen,
    selectedServer, setSelectedServer,
    formData, setFormData,
    command, setCommand,
    commandResult, setCommandResult,
    isExecuting,
    complianceResults,
    isRunningCompliance,
    activeTab, setActiveTab,
    showComplianceOptions, setShowComplianceOptions,
    selectedTag, setSelectedTag,
    selectedGroupId, setSelectedGroupId,
    isImportModalOpen, setIsImportModalOpen,
    isGroupModalOpen, setIsGroupModalOpen,
    isDeleteConfirmOpen, setIsDeleteConfirmOpen,
    pendingDeleteServer, setPendingDeleteServer,
    isCollecting,
    isCollectingMetrics,
    collectingServerIds,
    collectingMetricsServerIds,
    // AI — isAiCommandModalOpen, setIsAiCommandModalOpen,
    isAiCommandModalOpen, setIsAiCommandModalOpen,
    aiCommandServer,
    aiPrompt, setAiPrompt,
    aiGeneratedCommand, setAiGeneratedCommand,
    aiCommandExplanation, setAiCommandExplanation,
    isAiGenerating, selectedAiAgent,
    showAiCommandConfirm, setShowAiCommandConfirm,
    aiGenerationError, setAiGenerationError,
    // SSH — selectedSshKeyId, setSelectedSshKeyId,
    selectedSshKeyId, setSelectedSshKeyId,
    sshKeySearchQuery, setSshKeySearchQuery,
    showSshKeyDropdown, setShowSshKeyDropdown,
    groupFormData, setGroupFormData, editingGroup, setEditingGroup,
    importData, setImportData, importResult,
    // Sidebar — showGroups, setShowGroups,
    showGroups, setShowGroups,
    // Tags — tagDropdownOpen, setTagDropdownOpen, tagInputRef, tagDropdownRef,
    tagDropdownOpen, setTagDropdownOpen, tagInputRef, tagDropdownRef,
    // Compliance options
    complianceOptions, setComplianceOptions,
    // Data
    agents, sshKeys, groupsData, servers, isLoading,
    allTags,
    filteredTagSuggestions,
    filteredServers,
    commandHistory,
    complianceHistory,
    // Tag utilities
    parseCurrentTags, addTagToInput, removeTag,
    // Handlers
    resetForm, handleSubmit, handleEdit, handleTestConnection,
    handleExecuteCommand, handleRunCompliance, startComplianceCheck,
    handleCollectInfo, handleAiGenerateCommand, handleExecuteAiCommand,
    confirmExecuteAiCommand, handleCollectAll, handleCollectMetrics,
    handleCollectAllMetrics, handleGroupSubmit, handleDeleteGroup, handleImport,
    openAiCommandForServer,
    // Mutations
    deleteMutation,
    // Nav
    navigate, queryClient,
  } = actions;

  const batchSelectedServers = (servers || []).filter((s) => batchSelectedIds.has(s.id));

  const showCommandSection =
    selectedServer && (activeTab === 'servers' || activeTab === 'compliance');

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        <ServerToolbar
          queryClient={queryClient}
          resetForm={resetForm}
          setSelectedServer={setSelectedServer}
          setIsModalOpen={setIsModalOpen}
          selectedServer={selectedServer}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        {/* Tab 内容 */}
        {activeTab === 'servers' && (
          <>
            <ServerListSection
              servers={servers || []}
              isLoading={isLoading}
              groupsData={groupsData}
              allTags={allTags}
              filteredServers={filteredServers}
              selectedTag={selectedTag}
              onSelectTag={setSelectedTag}
              selectedGroupId={selectedGroupId}
              onSelectGroupId={setSelectedGroupId}
              showGroups={showGroups}
              onToggleGroups={() => setShowGroups(!showGroups)}
              isCollecting={isCollecting}
              isCollectingMetrics={isCollectingMetrics}
              collectingServerIds={collectingServerIds}
              collectingMetricsServerIds={collectingMetricsServerIds}
              onCollectAll={handleCollectAll}
              onCollectAllMetrics={handleCollectAllMetrics}
              onOpenImport={() => {
                setIsImportModalOpen(true);
                setImportData('');
              }}
              onOpenGroupModal={() => {
                setEditingGroup(null);
                setGroupFormData({ name: '', description: '', parent_id: null });
                setIsGroupModalOpen(true);
              }}
              onTestConnection={handleTestConnection}
              onCollectInfo={handleCollectInfo}
              onCollectMetrics={handleCollectMetrics}
              onEdit={handleEdit}
              onDelete={(id, name) => {
                setPendingDeleteServer({ id, name });
                setIsDeleteConfirmOpen(true);
              }}
              onOpenAiCommand={openAiCommandForServer}
              onSelectForCommand={(server) => {
                setSelectedServer(server);
                setCommandResult(null);
              }}
              onEditGroup={(group) => {
                // 编辑分组：预填表单并打开弹窗
                setEditingGroup(group);
                setGroupFormData({
                  name: group.name || '',
                  description: group.description || '',
                  parent_id: group.parent_id || null,
                });
                setIsGroupModalOpen(true);
              }}
              batchSelectedIds={batchSelectedIds}
              onToggleBatchSelect={toggleBatchSelect}
              onClearBatchSelection={() => setBatchSelectedIds(new Set())}
              onOpenBatchCommand={() => setIsBatchModalOpen(true)}
              onDeleteGroup={handleDeleteGroup}
              onRunCompliance={handleRunCompliance}
              onViewCommandHistory={(server) => {
                setSelectedServer(server);
                setActiveTab('command-history');
              }}
              onViewComplianceHistory={(server) => {
                setSelectedServer(server);
                setActiveTab('compliance-history');
              }}
            />
            {showCommandSection && (
              <CommandSection
                selectedServer={selectedServer}
                command={command}
                onCommandChange={setCommand}
                commandResult={commandResult}
                onClearResult={() => setCommandResult(null)}
                isExecuting={isExecuting}
                onExecute={handleExecuteCommand}
              />
            )}
          </>
        )}

        {activeTab === 'compliance' && selectedServer && (
          <ComplianceSection
            selectedServer={selectedServer}
            isRunningCompliance={isRunningCompliance}
            complianceResults={complianceResults}
            complianceOptions={complianceOptions}
            onComplianceOptionsChange={setComplianceOptions as unknown as (fn: (prev: { useAI: boolean; concurrency: number }) => { useAI: boolean; concurrency: number }) => void}
            onRunCompliance={handleRunCompliance}
          />
        )}

        {activeTab === 'command-history' && selectedServer && (
          <CommandHistorySection
            selectedServer={selectedServer}
            commandHistory={commandHistory}
          />
        )}

        {activeTab === 'compliance-history' && selectedServer && (
          <ComplianceHistorySection
            selectedServer={selectedServer}
            complianceHistory={complianceHistory}
          />
        )}

        {/* ========== Modals ========== */}

        <ServerFormModal
          isOpen={isModalOpen}
          selectedServer={selectedServer}
          formData={formData}
          onFormDataChange={setFormData}
          onSubmit={handleSubmit}
          onClose={() => {
            setIsModalOpen(false);
            resetForm();
            setSelectedServer(null);
          }}
          resetForm={resetForm}
          parseCurrentTags={parseCurrentTags}
          getLastTagFragment={() => {
            const raw = formData.tags;
            const lastCommaIndex = raw.lastIndexOf(',');
            return lastCommaIndex >= 0 ? raw.substring(lastCommaIndex + 1).trim() : (raw || '').trim();
          }}
          addTagToInput={addTagToInput}
          removeTag={removeTag}
          tagDropdownOpen={tagDropdownOpen}
          setTagDropdownOpen={setTagDropdownOpen}
          tagInputRef={tagInputRef}
          tagDropdownRef={tagDropdownRef}
          filteredTagSuggestions={filteredTagSuggestions}
          allTags={allTags}
          sshKeys={sshKeys}
          sshKeySearchQuery={sshKeySearchQuery}
          onSshKeySearchQueryChange={setSshKeySearchQuery}
          showSshKeyDropdown={showSshKeyDropdown}
          onShowSshKeyDropdownChange={setShowSshKeyDropdown}
          selectedSshKeyId={selectedSshKeyId}
          onSelectedSshKeyIdChange={setSelectedSshKeyId}
          navigate={navigate}
        />

        <ServerImportSection
          isOpen={isImportModalOpen}
          importData={importData}
          onImportDataChange={setImportData}
          importResult={importResult}
          onClose={() => setIsImportModalOpen(false)}
          onImport={handleImport}
        />

        <ServerGroupModal
          isOpen={isGroupModalOpen}
          editingGroup={editingGroup}
          groupFormData={groupFormData}
          onGroupFormDataChange={setGroupFormData}
          groupsData={groupsData}
          onClose={() => {
            setIsGroupModalOpen(false);
            setEditingGroup(null);
          }}
          onSubmit={handleGroupSubmit}
        />

        <AiCommandSection
          isOpen={isAiCommandModalOpen}
          aiCommandServer={aiCommandServer}
          aiPrompt={aiPrompt}
          onAiPromptChange={setAiPrompt}
          aiGeneratedCommand={aiGeneratedCommand}
          onAiGeneratedCommandChange={setAiGeneratedCommand}
          aiCommandExplanation={aiCommandExplanation}
          aiGenerationError={aiGenerationError}
          isAiGenerating={isAiGenerating}
          selectedAiAgent={selectedAiAgent}
          showAiCommandConfirm={showAiCommandConfirm}
          onClose={() => {
            setIsAiCommandModalOpen(false);
            setAiPrompt('');
            setAiGeneratedCommand('');
            setAiCommandExplanation('');
            setAiGenerationError('');
            setShowAiCommandConfirm(false);
          }}
          onGenerate={handleAiGenerateCommand}
          onExecute={handleExecuteAiCommand}
          onConfirmExecute={confirmExecuteAiCommand}
          onCancelConfirm={() => setShowAiCommandConfirm(false)}
        />

        <ServerDeleteConfirmModal
          isOpen={isDeleteConfirmOpen}
          serverName={pendingDeleteServer?.name || ''}
          onClose={() => {
            setIsDeleteConfirmOpen(false);
            setPendingDeleteServer(null);
          }}
          onConfirm={() => {
            if (pendingDeleteServer) {
              deleteMutation.mutate(pendingDeleteServer.id);
            }
          }}
        />

        <ServerComplianceOptionsModal
          isOpen={showComplianceOptions}
          selectedServer={selectedServer}
          complianceOptions={complianceOptions}
          onComplianceOptionsChange={setComplianceOptions as unknown as (updater: (prev: { useAI: boolean; concurrency: number }) => { useAI: boolean; concurrency: number }) => void}
          isRunningCompliance={isRunningCompliance}
          onClose={() => setShowComplianceOptions(false)}
          onStartCheck={startComplianceCheck}
        />

        {/* 批量执行命令 */}
        <BatchCommandModal
          open={isBatchModalOpen}
          servers={batchSelectedServers}
          onClose={() => {
            setIsBatchModalOpen(false);
            // 执行完成/关闭后清空选择
            setBatchSelectedIds(new Set());
          }}
          onFinished={() => {
            // 执行完成后清空选择
            setBatchSelectedIds(new Set());
          }}
        />
      </div>
    </div>
  );
}