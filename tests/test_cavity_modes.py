"""Independent analytic checks for the optional SciPy cavity eigensolver."""
import unittest,sys,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'cad'))
from cavity_modes import solve

class CavityModes(unittest.TestCase):
    def tube(self,n):
        length=2.;h=length/n;weight=1/h**2
        diagonal=[2*weight]*n;diagonal[0]=weight;diagonal[-1]=3*weight
        return solve(dict(diagonal=diagonal,edges=[[i,i+1,weight]for i in range(n-1)],c=343,meta={}),4)
    def test_closed_open_modes_and_second_order_mesh_convergence(self):
        coarse=self.tube(30);fine=self.tube(60)
        for i in range(4):
            exact=343*(2*i+1)/8
            self.assertLess(abs(fine['frequenciesHz'][i]/exact-1),.002)
            self.assertGreater(abs(coarse['frequenciesHz'][i]-exact)/abs(fine['frequenciesHz'][i]-exact),3.8)
        self.assertLess(max(fine['relativeResiduals']),1e-8)
    def test_rectangular_transverse_modes_are_not_lost_by_a_symmetric_start_vector(self):
        nx,ny,nz=7,8,20;pitch=[.2/nx,.3/ny,1/nz];n=nx*ny*nz;diagonal=[0.]*n;edges=[]
        def index(x,y,z):return x+nx*(y+ny*z)
        for z in range(nz):
            for y in range(ny):
                for x in range(nx):
                    a=index(x,y,z)
                    for axis,(q,size)in enumerate(zip([x,y,z],[nx,ny,nz])):
                        if q==size-1:continue
                        pt=[x,y,z];pt[axis]+=1;b=index(*pt);w=1/pitch[axis]**2
                        edges.append([a,b,w]);diagonal[a]+=w;diagonal[b]+=w
                    if z==nz-1:diagonal[a]+=2/pitch[2]**2
        result=solve(dict(diagonal=diagonal,edges=edges,c=343,meta={}),8)
        exact=sorted(343/(2*math.pi)*math.sqrt((2*math.sin(i*math.pi/(2*nx))/pitch[0])**2+(2*math.sin(j*math.pi/(2*ny))/pitch[1])**2+(2*math.sin((k+.5)*math.pi/(2*nz))/pitch[2])**2)for i in range(3)for j in range(3)for k in range(8))[:8]
        for actual,expected in zip(result['frequenciesHz'],exact):self.assertAlmostEqual(actual,expected,places=6)
    def test_disconnected_domains_are_not_silently_ignored(self):
        with self.assertRaisesRegex(ValueError,'disconnected'):solve(dict(diagonal=[1]*5,edges=[],c=343,meta={}),2)

if __name__=='__main__':unittest.main()
