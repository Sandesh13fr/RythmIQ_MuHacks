import { getDashboardData, getUserAccounts } from '@/actions/dashboard';
import CreateAccountDrawer from '@/components/create-account-drawer';
import { Card, CardContent } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import React, { Suspense } from 'react';
import AccountCard from './_components/account-card';
import { getCurrentBudget } from '@/actions/budget';
import BudgetProgress from './_components/budget-progress';
import { DashboardOverview } from './_components/transaction-overview';
import UpcomingObligationsWidget from '@/components/bills/UpcomingObligationsWidget';
import { getNudgeHistory } from '@/actions/nudge-actions';
import RecentNudges from './_components/recent-nudges';
import AgentConsole from './_components/agent-console';
import MiniCoach from '@/components/coach/MiniCoach';

async function DashboardPage() {
  const accounts = await getUserAccounts();

  const defaultAccount = accounts?.find((account) => account.isDefault);

  let budgetData = null;
  if (defaultAccount) {
    budgetData = await getCurrentBudget(defaultAccount.id);
  }

  const transactions = await getDashboardData();
  const recentNudgesResult = await getNudgeHistory(4);
  const recentNudges = recentNudgesResult?.nudges || [];

  return (
    <div className='space-y-8'>
      {/* Budget Progress */}
      {defaultAccount && (
        <BudgetProgress
          initialBudget={budgetData?.budget}
          currentExpenses={budgetData?.currentExpenses || 0}
        />
      )}

      {/* Upcoming Bills Widget */}
      <UpcomingObligationsWidget days={7} />

      {/* overview */}
      <Suspense fallback={"Loading Overview..."}>
        <DashboardOverview
          accounts={accounts}
          transactions={transactions || []}
        />
      </Suspense>

      {/* Agent activity */}
      <RecentNudges nudges={recentNudges} />

      {/* Judge demo controls */}
      <AgentConsole />

      {/* Financial mini-coach */}
      <MiniCoach />

      {/* Accounts grid */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <CreateAccountDrawer>
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-dashed">
            <CardContent className="flex flex-col items-center justify-center text-muted-foreground h-full pt-5">
              <Plus className='h-10 w-10 mb-2' />
              <p className='text-sm font-medium'>Add New Account</p>
            </CardContent>
          </Card>
        </CreateAccountDrawer>

        {accounts.length > 0 && accounts?.map((account) => {
          return <AccountCard key={account.id} account={account} />
        })}
      </div>
    </div>
  );
};

export default DashboardPage;